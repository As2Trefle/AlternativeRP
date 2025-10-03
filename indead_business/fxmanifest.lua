fx_version 'cerulean'
game 'gta5'

name 'indead_business'
author 'Dan'
description 'INDEAD Business (Indeed-like) for LB-Tablet'
version '0.0.5'

client_scripts {
  'client.lua',
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'server.lua',
}

files {
  'ui/index.html',

  -- assets
  'ui/assets/logoapp.jpg',
  'ui/assets/logo.png',
  'ui/assets/icon-bookmark.svg',
  'ui/assets/icon-folder.svg',
  'ui/assets/icon-bell.svg',
  'ui/assets/icon-user.svg',

  -- styles
  'ui/styles/main.css',
  'ui/styles/partials/header.css',
  'ui/styles/pages/login.css',
  'ui/styles/pages/home.css',
  'ui/styles/pages/profile.css',
  'ui/styles/pages/post.css',
  'ui/styles/pages/bookmark.css',
  'ui/styles/pages/applicants.css',

  -- partials
  'ui/partials/header.html',

  -- pages
  'ui/pages/login.html',
  'ui/pages/home.html',
  'ui/pages/profile.html',
  'ui/pages/post.html',
  'ui/pages/bookmark.html',
  'ui/pages/applicants.html',

  -- scripts
  'ui/scripts/router.js',
  'ui/scripts/pages/login.js',
  'ui/scripts/pages/home.js',
  'ui/scripts/pages/profile.js',
  'ui/scripts/pages/post.js',
  'ui/scripts/pages/bookmark.js',
  'ui/scripts/pages/applicants.js',
}
