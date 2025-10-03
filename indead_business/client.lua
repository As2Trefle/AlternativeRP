local QBCore = exports['qb-core']:GetCoreObject()
local APP_ID = 'indead_business'

local function registerApp()
    exports['lb-tablet']:AddCustomApp({
        identifier = APP_ID,
        name = 'INDEAD Business',
        description = 'Portail de connexion aux offres',
        developer = 'ALT',
        icon = '/ui/assets/logoapp.jpg',
        defaultApp = true,
        landscape = true,
        size = 1,
        ui = 'ui/index.html',
        -- plus d’onOpen ici : le thème est géré côté UI
    })
end

CreateThread(function()
    local waited = 0
    while not GetResourceState('lb-tablet'):find('start') and waited < 5000 do
        Wait(100); waited += 100
    end
    pcall(registerApp)
end)

-- === Enregistrement robuste auprès de lb-tablet (évite le bug après reboot) ===
local function SafeRegisterApp()
    local tries = 0
    while tries < 60 do -- jusqu'à ~60s
        if GetResourceState('lb-tablet') == 'started' then
            if type(registerApp) == 'function' then
                local ok, err = pcall(registerApp)
                if ok then
                    -- print('[indead_business] App enregistrée auprès de lb-tablet')
                    break
                end
                -- print(('[indead_business] registerApp erreur: %s'):format(err or ''))
            end
        end
        Wait(1000)
        tries = tries + 1
    end
end

-- Quand TA ressource démarre, on (re)essaie proprement
AddEventHandler('onClientResourceStart', function(resName)
    if resName == GetCurrentResourceName() then
        CreateThread(SafeRegisterApp)
    end
end)

-- Si lb-tablet démarre après toi, on s’enregistre à ce moment-là aussi
AddEventHandler('onClientResourceStart', function(resName)
    if resName == 'lb-tablet' then
        CreateThread(SafeRegisterApp)
    end
end)

-- Login
RegisterNUICallback('indead:login', function(_, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:login', function(result)
        cb(result or { ok = false, message = 'Réponse invalide.' })
    end)
end)

-- ✅ Profil : récupère OU crée selon le setjob
RegisterNUICallback('indead:getOrCreateCompany', function(_, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getOrCreateCompany', function(result)
        cb(result or { ok = false, message = 'Aucune entreprise.' })
    end)
end)

RegisterNUICallback('indead:updateCompany', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:updateCompany', function(result)
        cb(result or { ok = false, message = 'Mise à jour impossible.' })
    end, data)
end)

RegisterNUICallback('indead:createOffer', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:createOffer', function(result)
        cb(result or { ok = false, message = "Échec de la publication." })
    end, data)
end)

-- Toutes les offres (non expirées)
RegisterNUICallback('indead:getOffers', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getOffers', function(result)
        cb(result or { ok = false, items = {} })
    end)
end)

-- Détail (si tu veux recharger à la demande – pas obligatoire ici)
RegisterNUICallback('indead:getOffer', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getOffer', function(result)
        cb(result or { ok = false })
    end, data and data.id)
end)

-- Mes offres (toutes, y compris expirées)
RegisterNUICallback('indead:getMyOffers', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getMyOffers', function(result)
        cb(result or { ok=false, items={} })
    end)
end)

-- Réactiver une offre (update)
RegisterNUICallback('indead:reactivateOffer', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:reactivateOffer', function(result)
        cb(result or { ok = false, message = "Échec de la réactivation." })
    end, data.id, data.data)
end)

-- Mes offres : annuler (expire maintenant)
RegisterNUICallback('indead:cancelOffer', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:cancelOffer', function(result)
        cb(result or { ok = false, message = "Échec de l'annulation." })
    end, data and data.id)
end)

-- Mes offres : supprimer
RegisterNUICallback('indead:deleteOffer', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:deleteOffer', function(result)
        cb(result or { ok = false, message = "Échec de la suppression." })
    end, data and data.id)
end)

-- Badge de notif (compteur)
RegisterNUICallback('indead:getNotifyCount', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getNotifyCount', function(result)
        cb(result or { ok=false, count=0 })
    end)
end)

-- Ouvrir panneau & marquer lues
RegisterNUICallback('indead:openNotifications', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:openNotifications', function(result)
        cb(result or { ok=false, items={} })
    end)
end)

-- Page "Postulants" (liste)
RegisterNUICallback('indead:getApplicants', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getApplicants', function(result)
        cb(result or { ok=false, items={} })
    end)
end)

-- Détail profil postulant
RegisterNUICallback('indead:getApplicantProfile', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:getApplicantProfile', function(result)
        cb(result or { ok=false, profile=nil })
    end, data and data.citizenid)
end)

RegisterNUICallback('indead:updateApplicationStatus', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:server:updateApplicationStatus', function(result)
        cb(result or { ok=false })
    end, data)
end)

-- Appeler un candidat via LB-Phone (client export)
RegisterNUICallback('indead:callApplicant', function(data, cb)
    local num = data and tostring(data.phone or '') or ''
    local ok = false

    if num ~= '' then
        -- Nettoie les espaces/traits si besoin
        num = num:gsub('%s+', ''):gsub('%-', '')

        local success = pcall(function()
            -- Export client : ouvre l'UI téléphone et lance l'appel
            -- options: number | company, videoCall?, hideNumber?
            exports['lb-phone']:CreateCall({
                number = num,
                videoCall = false,
                hideNumber = false
            })
        end)
        ok = success
    end

    cb({ ok = ok })
end)

-- === Notifications: pont NUI -> serveur ===
RegisterNUICallback('indead_business:notifications:get', function(_, cb)
    QBCore.Functions.TriggerCallback('indead_business:notifications:get', function(result)
        cb(result or { ok = false, notifications = {} })
    end)
end)

RegisterNUICallback('indead_business:notifications:open', function(data, cb)
    QBCore.Functions.TriggerCallback('indead_business:notifications:open', function(result)
        cb(result or { ok = false })
    end, data or {})
end)

RegisterNUICallback('indead_business:notifications:markAll', function(_, cb)
    QBCore.Functions.TriggerCallback('indead_business:notifications:markAll', function(result)
        cb(result or { ok = false })
    end)
end)
