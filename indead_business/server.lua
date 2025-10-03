local QBCore = exports['qb-core']:GetCoreObject()

CreateThread(function()
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `indead_business_companies` (
            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `job_name`  VARCHAR(64)  NOT NULL UNIQUE,
            `job_label` VARCHAR(128) NOT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            `address`       VARCHAR(255) NULL,
            `about_html`    LONGTEXT    NULL,
            `company_type`  VARCHAR(64)  NULL,
            `owner_name`    VARCHAR(128) NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
    MySQL.query([[
    CREATE TABLE IF NOT EXISTS `indead_business_notify` (
        `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `offer_code` VARCHAR(32) NOT NULL,
        `candidate_citizenid` VARCHAR(64) NOT NULL,
        `candidate_firstname` VARCHAR(64) NULL,
        `candidate_lastname`  VARCHAR(64) NULL,
        `notify` TINYINT(1) NOT NULL DEFAULT 0,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `k_offer` (`offer_code`),
        KEY `k_candidate` (`candidate_citizenid`),
        KEY `k_notify` (`notify`)
    )
    ]])

    MySQL.query([[
    CREATE TABLE IF NOT EXISTS `indead_app_notify` (
        `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `offer_code` VARCHAR(32) NOT NULL,
        `candidate_citizenid` VARCHAR(64) NOT NULL,
        `message` VARCHAR(255) NOT NULL,
        `read` TINYINT(1) NOT NULL DEFAULT 0,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `k_offer` (`offer_code`),
        KEY `k_candidate` (`candidate_citizenid`),
        KEY `k_read` (`read`)
    )
    ]])
end)

local function getPlayerJobInfo(src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return nil, 'Joueur introuvable.' end
    local job = Player.PlayerData and Player.PlayerData.job or {}
    local name  = job.name  or 'unemployed'
    local label = job.label or name
    local ci    = Player.PlayerData and Player.PlayerData.charinfo or {}
    local fullname = (ci.firstname and ci.lastname) and (ci.firstname .. ' ' .. ci.lastname) or nil

    if name == 'unemployed' or name == 'none' then
        return nil, "Vous devez avoir un emploi pour accéder à l'application."
    end

    local isBoss = false
    if job.isboss ~= nil then isBoss = job.isboss == true
    elseif job.grade and job.grade.isboss ~= nil then isBoss = job.grade.isboss == true
    end

    return { name = name, label = label, isBoss = isBoss, fullname = fullname }, nil
end

-- Login (inchangé, création minimale + contrôle boss)
QBCore.Functions.CreateCallback('indead_business:server:login', function(source, cb)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    if not info.isBoss then
        cb({ ok=false, message="Accès refusé : vous devez être le patron (boss) de votre entreprise." })
        return
    end

    local company = MySQL.single.await('SELECT * FROM indead_business_companies WHERE job_name = ?', { info.name })

    if not company then
        local insertId = MySQL.insert.await(
            'INSERT INTO indead_business_companies (job_name, job_label, owner_name) VALUES (?, ?, ?)',
            { info.name, info.label, info.fullname }
        )
        company = MySQL.single.await('SELECT * FROM indead_business_companies WHERE id = ?', { insertId })
    else
        if company.job_label ~= info.label then
            MySQL.update.await('UPDATE indead_business_companies SET job_label = ? WHERE id = ?', { info.label, company.id })
            company.job_label = info.label
        end
        if (not company.owner_name or company.owner_name == '') and info.fullname then
            MySQL.update.await('UPDATE indead_business_companies SET owner_name = ? WHERE id = ?', { info.fullname, company.id })
            company.owner_name = info.fullname
        end
    end

    cb({ ok=true, company = company })
end)

-- ✅ Profil : renvoie la fiche, et la crée si absente (sans exiger boss pour la simple consultation)
QBCore.Functions.CreateCallback('indead_business:server:getOrCreateCompany', function(source, cb)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end

    local company = MySQL.single.await('SELECT * FROM indead_business_companies WHERE job_name = ?', { info.name })
    if not company then
        local insertId = MySQL.insert.await(
            'INSERT INTO indead_business_companies (job_name, job_label, owner_name) VALUES (?, ?, ?)',
            { info.name, info.label, info.fullname }
        )
        company = MySQL.single.await('SELECT * FROM indead_business_companies WHERE id = ?', { insertId })
    else
        if company.job_label ~= info.label then
            MySQL.update.await('UPDATE indead_business_companies SET job_label = ? WHERE id = ?', { info.label, company.id })
            company.job_label = info.label
        end
        if (not company.owner_name or company.owner_name == '') and info.fullname then
            MySQL.update.await('UPDATE indead_business_companies SET owner_name = ? WHERE id = ?', { info.fullname, company.id })
            company.owner_name = info.fullname
        end
    end

    cb({ ok=true, company = company })
end)

local function getPlayerJobInfo(src)
    local QBCore = exports['qb-core']:GetCoreObject()
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return nil, 'Joueur introuvable.' end
    local job = Player.PlayerData and Player.PlayerData.job or {}
    local name  = job.name  or 'unemployed'
    local label = job.label or name
    local ci    = Player.PlayerData and Player.PlayerData.charinfo or {}
    local fullname = (ci.firstname and ci.lastname) and (ci.firstname .. ' ' .. ci.lastname) or nil

    local isBoss = false
    if job.isboss ~= nil then isBoss = job.isboss == true
    elseif job.grade and job.grade.isboss ~= nil then isBoss = job.grade.isboss == true
    end
    return { name = name, label = label, isBoss = isBoss, fullname = fullname }, nil
end

local function clip(s, max)
    if not s then return nil end
    s = s:gsub('^%s+',''):gsub('%s+$','')
    if s == '' then return nil end
    if #s > max then s = s:sub(1, max) end
    return s
end

-- ✅ Mise à jour (boss uniquement), label intouchable
QBCore.Functions.CreateCallback('indead_business:server:updateCompany', function(source, cb, payload)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end

    local company = MySQL.single.await('SELECT * FROM indead_business_companies WHERE job_name = ?', { info.name })
    if not company then
        cb({ ok=false, message='Entreprise introuvable.' })
        return
    end

    if not info.isBoss then
        cb({ ok=false, message="Accès refusé : seul le patron peut modifier le profil." })
        return
    end

    local address      = clip(payload and payload.address, 255)
    local owner_name   = clip(payload and payload.owner_name, 128)
    local company_type = clip(payload and payload.company_type, 64)

    local sets, vals = {}, {}
    if address ~= nil then table.insert(sets, 'address = ?');       table.insert(vals, address) end
    if owner_name ~= nil then table.insert(sets, 'owner_name = ?'); table.insert(vals, owner_name) end
    if company_type ~= nil then table.insert(sets, 'company_type = ?'); table.insert(vals, company_type) end

    if #sets == 0 then
        cb({ ok=true, company = company }) -- rien à changer
        return
    end

    table.insert(vals, company.id)
    local sql = ('UPDATE indead_business_companies SET %s WHERE id = ?'):format(table.concat(sets, ', '))
    MySQL.update.await(sql, vals)

    local updated = MySQL.single.await('SELECT * FROM indead_business_companies WHERE id = ?', { company.id })
    cb({ ok=true, company = updated })
end)

local function clip(s, max)
    if s == nil then return nil end
    s = tostring(s):gsub('^%s+',''):gsub('%s+$','')
    if s == '' then return nil end
    if max and #s > max then s = s:sub(1, max) end
    return s
end

local function randCode(len)
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    local out = {}
    for i=1, len do
        local r = math.random(1, #chars)
        out[i] = chars:sub(r, r)
    end
    return table.concat(out)
end

QBCore.Functions.CreateCallback('indead_business:server:createOffer', function(source, cb, data)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    if not info.isBoss then cb({ ok=false, message="Seul le patron peut publier une offre." }); return end

    local title         = clip(data and data.title, 120)
    if not title then cb({ ok=false, message='Le titre est obligatoire.' }); return end
    local location      = clip(data and data.location, 255)
    local response_val  = tonumber(data and data.response_value) or 1
    if response_val < 1 then response_val = 1 end
    local unitIn        = tostring(data and data.response_unit or '')
    local response_unit = (unitIn == 'semaines' or unitIn == 'semaine') and 'semaines' or 'jours'
    local salary_badge  = clip(data and data.salary_badge, 64)
    local contract_type = clip(data and data.contract_type, 64)
    local details_html  = tostring(data and data.details_html or '')

    -- Génère un code unique IB-XXXXXXXX
    local offer_code
    for _=1,5 do
        local try = 'IB-' .. randCode(8)
        local exists = MySQL.scalar.await('SELECT 1 FROM indead_business_offers WHERE offer_code = ? LIMIT 1', { try })
        if not exists then offer_code = try break end
    end
    if not offer_code then offer_code = 'IB-' .. randCode(8) end

    local created_at = os.date('%Y-%m-%d %H:%M:%S')
    local expires_at = os.date('%Y-%m-%d %H:%M:%S', os.time() + 48 * 3600)

    local insertedId = MySQL.insert.await([[
        INSERT INTO indead_business_offers
        (offer_code, job_name, job_label, title, location, response_value, response_unit, salary_badge, contract_type, details_html, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        offer_code, info.name, info.label, title, location,
        response_val, response_unit, salary_badge, contract_type, details_html,
        created_at, expires_at
    })

    if not insertedId or insertedId == 0 then
        cb({ ok=false, message='Insertion SQL échouée.' })
        return
    end

    cb({ ok=true, id=insertedId, offer_code=offer_code, created_at=created_at, expires_at=expires_at })
end)

-- Liste des offres (toutes entreprises, non expirées)
QBCore.Functions.CreateCallback('indead_business:server:getOffers', function(source, cb)
    local rows = MySQL.query.await([[
        SELECT o.id, o.offer_code, o.job_name, o.job_label, o.title, o.location,
               o.response_value, o.response_unit, o.salary_badge, o.contract_type,
               o.details_html, o.created_at, o.expires_at,
               c.company_type
        FROM indead_business_offers o
        LEFT JOIN indead_business_companies c ON c.job_name = o.job_name
        WHERE (o.expires_at IS NULL OR o.expires_at >= NOW())
        ORDER BY o.created_at DESC
        LIMIT 200
    ]], {})

    cb({ ok = true, items = rows or {} })
end)

-- Détail d'une offre (optionnel pour ce flux)
QBCore.Functions.CreateCallback('indead_business:server:getOffer', function(source, cb, id)
    if not id then cb({ ok=false, message='id manquant' }); return end
    local row = MySQL.single.await([[
        SELECT o.id, o.offer_code, o.job_name, o.job_label, o.title, o.location,
               o.response_value, o.response_unit, o.salary_badge, o.contract_type,
               o.details_html, o.created_at, o.expires_at,
               c.company_type
        FROM indead_business_offers o
        LEFT JOIN indead_business_companies c ON c.job_name = o.job_name
        WHERE o.id = ?
        LIMIT 1
    ]], { id })
    cb({ ok = row ~= nil, item = row })
end)

-- Mes offres (uniquement le job du joueur) : inclut expirées
QBCore.Functions.CreateCallback('indead_business:server:getMyOffers', function(source, cb)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, items={}, message=err }); return end

    local rows = MySQL.query.await([[
        SELECT o.id, o.offer_code, o.job_name, o.job_label, o.title, o.location,
               o.response_value, o.response_unit, o.salary_badge, o.contract_type,
               o.details_html, o.created_at, o.expires_at,
               (o.expires_at IS NOT NULL AND o.expires_at < NOW()) AS expired,  -- 0/1
               c.company_type
        FROM indead_business_offers o
        LEFT JOIN indead_business_companies c ON c.job_name = o.job_name
        WHERE o.job_name = ?
        ORDER BY o.created_at DESC
        LIMIT 200
    ]], { info.name })

    cb({ ok = true, items = rows or {} })
end)

QBCore.Functions.CreateCallback('indead_business:server:reactivateOffer', function(source, cb, id, data)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    if not info.isBoss then cb({ ok=false, message="Seul le patron peut réactiver une offre." }); return end
    id = tonumber(id)
    if not id then cb({ ok=false, message='ID invalide.' }); return end

    -- Vérifie que l'offre appartient bien au job du joueur
    local row = MySQL.single.await('SELECT id, job_name, offer_code FROM indead_business_offers WHERE id = ? LIMIT 1', { id })
    if not row then cb({ ok=false, message='Offre introuvable.' }); return end
    if tostring(row.job_name) ~= tostring(info.name) then
        cb({ ok=false, message="Cette offre n'appartient pas à votre entreprise." }); return
    end

    local function clip(s, max)
      if s == nil then return nil end
      s = tostring(s):gsub('^%s+',''):gsub('%s+$','')
      if s == '' then return nil end
      if max and #s > max then s = s:sub(1, max) end
      return s
    end

    local title         = clip(data and data.title, 120)
    if not title then cb({ ok=false, message='Le titre est obligatoire.' }); return end
    local location      = clip(data and data.location, 255)
    local response_val  = tonumber(data and data.response_value) or 1
    if response_val < 1 then response_val = 1 end
    local unitIn        = tostring(data and data.response_unit or '')
    local response_unit = (unitIn == 'semaines' or unitIn == 'semaine') and 'semaines' or 'jours'
    local salary_badge  = clip(data and data.salary_badge, 64)
    local contract_type = clip(data and data.contract_type, 64)
    local details_html  = tostring(data and data.details_html or '')

    local created_at = os.date('%Y-%m-%d %H:%M:%S')
    local expires_at = os.date('%Y-%m-%d %H:%M:%S', os.time() + 48 * 3600)

    local ok = MySQL.update.await([[
      UPDATE indead_business_offers
      SET title = ?, location = ?, response_value = ?, response_unit = ?,
          salary_badge = ?, contract_type = ?, details_html = ?,
          created_at = ?, expires_at = ?
      WHERE id = ?
    ]], {
      title, location, response_val, response_unit,
      salary_badge, contract_type, details_html,
      created_at, expires_at, id
    })

    if not ok or ok < 1 then
        cb({ ok=false, message='Mise à jour SQL échouée.' })
        return
    end

    cb({ ok=true, id=id, offer_code=row.offer_code, created_at=created_at, expires_at=expires_at })
end)

-- Annuler une offre (forcer l'expiration à maintenant)
QBCore.Functions.CreateCallback('indead_business:server:cancelOffer', function(source, cb, id)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    id = tonumber(id)
    if not id then cb({ ok=false, message='ID invalide.' }); return end

    -- Vérifie la propriété
    local row = MySQL.single.await('SELECT id, job_name, expires_at FROM indead_business_offers WHERE id = ? LIMIT 1', { id })
    if not row then cb({ ok=false, message='Offre introuvable.' }); return end
    if tostring(row.job_name) ~= tostring(info.name) then
        cb({ ok=false, message="Cette offre n'appartient pas à votre entreprise." }); return
    end

    local now = os.date('%Y-%m-%d %H:%M:%S')
    local ok = MySQL.update.await('UPDATE indead_business_offers SET expires_at = ? WHERE id = ?', { now, id })
    if not ok or ok < 1 then
        cb({ ok=false, message="Impossible d'expirer l'offre." })
        return
    end
    cb({ ok=true, id=id, expires_at=now })
end)

-- Supprimer une offre définitivement
QBCore.Functions.CreateCallback('indead_business:server:deleteOffer', function(source, cb, id)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    id = tonumber(id)
    if not id then cb({ ok=false, message='ID invalide.' }); return end

    -- Vérifie la propriété
    local row = MySQL.single.await('SELECT id, job_name FROM indead_business_offers WHERE id = ? LIMIT 1', { id })
    if not row then cb({ ok=false, message='Offre introuvable.' }); return end
    if tostring(row.job_name) ~= tostring(info.name) then
        cb({ ok=false, message="Cette offre n'appartient pas à votre entreprise." }); return
    end

    local ok = MySQL.update.await('DELETE FROM indead_business_offers WHERE id = ?', { id })
    if not ok or ok < 1 then
        cb({ ok=false, message="La suppression a échoué." })
        return
    end
    cb({ ok=true, id=id })
end)

-- Compter les notifications non lues (notify = 0)
QBCore.Functions.CreateCallback('indead_business:server:getNotifyCount', function(source, cb)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, count=0, message=err }); return end
    local row = MySQL.single.await('SELECT COUNT(*) AS c FROM indead_applications WHERE company_job_name = ? AND notify = 0', { info.name })
    cb({ ok=true, count = row and row.c or 0 })
end)

-- Ouvrir le panneau : récupérer les nouvelles notifs ET les marquer vues
QBCore.Functions.CreateCallback('indead_business:server:openNotifications', function(source, cb)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, items={}, message=err }); return end

    local items = MySQL.query.await([[
        SELECT id, offer_id, offer_code, firstname, lastname, created_at
        FROM indead_applications
        WHERE company_job_name = ? AND notify = 0
        ORDER BY created_at DESC
        LIMIT 50
    ]], { info.name }) or {}

    if #items > 0 then
        MySQL.update.await('UPDATE indead_applications SET notify = 1, updated_at = NOW() WHERE company_job_name = ? AND notify = 0', { info.name })
    end

    cb({ ok=true, items=items })
end)

-- Liste des postulants de l'entreprise (tous statuts)
QBCore.Functions.CreateCallback('indead_business:server:getApplicants', function(source, cb)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, items={}, message=err }); return end

    local rows = MySQL.query.await([[
        SELECT a.id, a.offer_id, a.offer_code, a.firstname, a.lastname, a.applicant_citizenid,
               a.status, a.created_at, o.title AS offer_title
        FROM indead_applications a
        LEFT JOIN indead_business_offers o ON o.id = a.offer_id
        WHERE a.company_job_name = ?
        ORDER BY a.created_at DESC
        LIMIT 200
    ]], { info.name }) or {}

    cb({ ok=true, items=rows })
end)

QBCore.Functions.CreateCallback('indead_business:server:getApplicantProfile', function(source, cb, citizenid)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    if not citizenid or citizenid == '' then cb({ ok=false, message='citizenid manquant' }); return end

    local row = MySQL.single.await([[
        SELECT firstname, lastname, email, phone, cv_json
        FROM indead_users
        WHERE citizenid = ?
        LIMIT 1
    ]], { citizenid })

    cb({ ok=true, profile=row or {} })
end)

-- Met à jour le statut d'une candidature (normalisation + tolérance)
QBCore.Functions.CreateCallback('indead_business:server:updateApplicationStatus', function(source, cb, data)
    local info, err = getPlayerJobInfo(source)
    if not info then cb({ ok=false, message=err }); return end
    if not data or not data.id or not data.status then cb({ ok=false, message="Paramètres manquants" }); return end

    local normalize = {
        ["NOUVEAU"]  = "NOUVEAU",
        ["EN_COURS"] = "EN_COURS",
        ["ACCEPTER"] = "ACCEPTE",
        ["ACCEPTE"]  = "ACCEPTE",
        ["REFUSER"]  = "REFUSE",
        ["REFUSE"]   = "REFUSE",
    }
    local target = normalize[tostring(data.status)]
    if not target then cb({ ok=false, message="Statut invalide" }); return end

    local changed = MySQL.update.await(
        [[ UPDATE indead_applications
           SET status = ?, updated_at = NOW()
           WHERE id = ? AND company_job_name = ? ]],
        { target, tonumber(data.id), info.name }
    )
    -- changed peut être 0 si même valeur : on considère que c'est OK
    cb({ ok = (changed ~= false), status = target })
end)

-- =========================
-- =  Notifications Patron =
-- =========================
QBCore.Functions.CreateCallback('indead_business:notifications:get', function(src, cb)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then
        cb({ ok = false, notifications = {} })
        return
    end

    local jobName = Player.PlayerData and Player.PlayerData.job and Player.PlayerData.job.name
    if not jobName or jobName == '' then
        cb({ ok = true, notifications = {} })
        return
    end

    -- Une seule requête, robuste : match sur n.entreprise (setjob) OU via l’offre (o.job_name)
    local rows = MySQL.query.await([[
        SELECT n.id, n.entreprise, n.offer_code, n.candidate_citizenid,
               n.candidate_firstname, n.candidate_lastname, n.created_at
        FROM indead_business_notify n
        LEFT JOIN indead_business_offers o ON o.offer_code = n.offer_code
        WHERE n.notify = 0
          AND (
                (n.entreprise IS NOT NULL AND LOWER(TRIM(n.entreprise)) = LOWER(TRIM(?)))
             OR (o.job_name IS NOT NULL AND LOWER(TRIM(o.job_name)) = LOWER(TRIM(?)))
          )
        ORDER BY n.id DESC
        LIMIT 100
    ]], { jobName, jobName }) or {}

    -- Log diag (voit le setjob et combien de notifs on renvoie)
    print(('[indead_business] notifications:get setjob="%s" -> %d notif(s)'):format(jobName, #rows))

    cb({ ok = true, notifications = rows })
end)

-- Clic sur une notif : passe la candidature EN_COURS + supprime la notif + route vers applicants
QBCore.Functions.CreateCallback('indead_business:notifications:open', function(src, cb, data)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then cb({ ok = false }) return end

    local jobName    = Player.PlayerData and Player.PlayerData.job and Player.PlayerData.job.name
    local offer_code = data and data.offer_code
    local cid        = data and data.candidate_citizenid

    if (not jobName) or (not offer_code) or (not cid) then
        cb({ ok = false })
        return
    end

    -- Vérifie que la notif appartient bien au setjob (via entreprise ou via l’offre)
    local notif = MySQL.single.await([[
        SELECT n.id
        FROM indead_business_notify n
        LEFT JOIN indead_business_offers o ON o.offer_code = n.offer_code
        WHERE n.offer_code = ? AND n.candidate_citizenid = ?
          AND (
                (n.entreprise IS NOT NULL AND LOWER(TRIM(n.entreprise)) = LOWER(TRIM(?)))
             OR (o.job_name IS NOT NULL AND LOWER(TRIM(o.job_name)) = LOWER(TRIM(?)))
          )
        LIMIT 1
    ]], { offer_code, cid, jobName, jobName })

    if not notif then
        print(('[indead_business] notifications:open REFUSED (setjob=%s, offer=%s, cid=%s)'):format(jobName, offer_code, cid))
        cb({ ok = false })
        return
    end

    -- Passe la candidature EN_COURS
    local updated = MySQL.update.await([[
        UPDATE indead_applications
        SET status = 'EN_COURS', updated_at = NOW()
        WHERE offer_code = ? AND citizenid = ?
        LIMIT 1
    ]], { offer_code, cid }) or 0

    -- Supprime la notif correspondante (elle ne doit plus réapparaître)
    MySQL.query.await([[
        DELETE n FROM indead_business_notify n
        LEFT JOIN indead_business_offers o ON o.offer_code = n.offer_code
        WHERE n.offer_code = ? AND n.candidate_citizenid = ?
          AND (
                (n.entreprise IS NOT NULL AND LOWER(TRIM(n.entreprise)) = LOWER(TRIM(?)))
             OR (o.job_name IS NOT NULL AND LOWER(TRIM(o.job_name)) = LOWER(TRIM(?)))
          )
    ]], { offer_code, cid, jobName, jobName })

    print(('[indead_business] notifications:open OK (setjob=%s, offer=%s, cid=%s, updated=%s)'):format(jobName, offer_code, cid, tostring(updated > 0)))

    cb({
        ok        = true,
        updated   = (updated > 0),
        route     = 'applicants',
        offer_code = offer_code,
        citizenid  = cid
    })
end)

-- Tout marquer comme lu : passe toutes les candidatures liées EN_COURS + supprime toutes les notifs de l'entreprise
QBCore.Functions.CreateCallback('indead_business:notifications:markAll', function(src, cb)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then cb({ ok = false }) return end

    local jobName = Player.PlayerData and Player.PlayerData.job and Player.PlayerData.job.name
    if not jobName or jobName == '' then cb({ ok = false }) return end

    -- Passe EN_COURS toutes les candidatures liées aux notifs de ce setjob
    local upd = MySQL.update.await([[
        UPDATE indead_applications a
        JOIN indead_business_notify n
          ON n.offer_code = a.offer_code
         AND n.candidate_citizenid = a.citizenid
        LEFT JOIN indead_business_offers o
          ON o.offer_code = n.offer_code
        SET a.status = 'EN_COURS', a.updated_at = NOW()
        WHERE n.notify = 0
          AND (
                (n.entreprise IS NOT NULL AND LOWER(TRIM(n.entreprise)) = LOWER(TRIM(?)))
             OR (o.job_name IS NOT NULL AND LOWER(TRIM(o.job_name)) = LOWER(TRIM(?)))
          )
    ]], { jobName, jobName }) or 0

    -- Supprime toutes les notifs de ce setjob
    MySQL.query.await([[
        DELETE n FROM indead_business_notify n
        LEFT JOIN indead_business_offers o ON o.offer_code = n.offer_code
        WHERE
            ( (n.entreprise IS NOT NULL AND LOWER(TRIM(n.entreprise)) = LOWER(TRIM(?)))
           OR (o.job_name IS NOT NULL AND LOWER(TRIM(o.job_name)) = LOWER(TRIM(?))) )
    ]], { jobName, jobName })

    print(('[indead_business] notifications:markAll setjob="%s" -> affected=%d'):format(jobName, tonumber(upd) or 0))

    cb({ ok = true, affected = upd })
end)
