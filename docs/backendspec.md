Backend Specification
==========================

Overview
========
This specification is intended to define the API contract for the backend REST and WebSocket APIs. 

REST API
========

## Title Endpoint
```
GET https://api.playstratus.io/title
```
Returns JSON object listing all titles.

```js
[{
  "titleId": "cf569896-d87b-4381-887e-01cb550069ec",
  "Display Name": "Call of Duty: Black Ops III",
  "Description": "Call of Duty: Black Ops III combines three unique game modes: Campaign, Multiplayer and Zombies, providing fans with the deepest and most ambitious Call of Duty ever. The Campaign has been designed as a co-op game that can be played with up to 4 players online or as a solo cinematic thrill-ride. Multiplayer will be the franchise’s deepest, most rewarding and most engaging to date, with new ways to rank up, customize, and gear up for battle. And Zombies delivers an all-new mind-blowing experience with its own dedicated narrative. The title ushers in an unprecedented level of innovation, including jaw-dropping environments, never before experienced weaponry and abilities, and the introduction of a new, improved fluid movement system.",
  "Developer": "Treyarch",
  "Genre": [
    "Action",
    "Shooter"
  ],
  "Collections": [
    "FreeTier",
    "Featured"
  ],
  "image_hero_capsule": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/8482770be5cfca24efad82aca1b3d95e2d94ba99/hero_capsule.jpg?t=1748022663",
  "image_hero_library": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/library_hero.jpg?t=1748022663",
  "Screenshots": [
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/ss_3a84113daacead987f549fbc3bd95fa9e66a833b.1920x1080.jpg?t=1748022663",
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/ss_dfcf315c0c02ae7b62b47306c4b9ae774c2b14d0.1920x1080.jpg?t=1748022663",
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/ss_01c9cbde469b82ab719fb30c491f5e1102894607.1920x1080.jpg?t=1748022663"
  ]
}]
```

```
GET https://api.playstratus.io/title/{titleId}/
```

Returns JSON object listing for the specifed titleId.

```js
{
  "titleId": "cf569896-d87b-4381-887e-01cb550069ec",
  "Display Name": "Call of Duty: Black Ops III",
  "Description": "Call of Duty: Black Ops III combines three unique game modes: Campaign, Multiplayer and Zombies, providing fans with the deepest and most ambitious Call of Duty ever. The Campaign has been designed as a co-op game that can be played with up to 4 players online or as a solo cinematic thrill-ride. Multiplayer will be the franchise’s deepest, most rewarding and most engaging to date, with new ways to rank up, customize, and gear up for battle. And Zombies delivers an all-new mind-blowing experience with its own dedicated narrative. The title ushers in an unprecedented level of innovation, including jaw-dropping environments, never before experienced weaponry and abilities, and the introduction of a new, improved fluid movement system.",
  "Developer": "Treyarch",
  "Collections": [
    "FreeTier",
    "Featured"
  ],
  "Genre": [
    "Action",
    "Shooter"
  ],
  "image_hero_capsule": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/8482770be5cfca24efad82aca1b3d95e2d94ba99/hero_capsule.jpg?t=1748022663",
  "image_hero_library": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/library_hero.jpg?t=1748022663",
  "Screenshots": [
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/ss_3a84113daacead987f549fbc3bd95fa9e66a833b.1920x1080.jpg?t=1748022663",
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/ss_dfcf315c0c02ae7b62b47306c4b9ae774c2b14d0.1920x1080.jpg?t=1748022663",
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/311210/ss_01c9cbde469b82ab719fb30c491f5e1102894607.1920x1080.jpg?t=1748022663"
  ]
}
```

# Auth Endpoint.


```
GET https://api.playstratus.io/title/{titleId}/
```

## Data Types

### SUID (Stratus User ID)
The SUID is a UUID V4 identifier that uniquely identifies a Stratus user.
EX:
```
79f0b18a-f50e-499b-a50e-cba848507525
```

### Tier (Current User Plan)
| Tier      |
| :------   | 
| Free      |
| Student   |
| Developer | 

### CreationDate (Date Stratus Account Created)
The CreationDate atrribute is the set to the UTC time the user created their account. This should be a string compliant with the ISO 8601 standard.
```
GET https://api.playstratus.io/user/me
```

Returns JSON object listing all titles.

```js
[{
  "SUID": "79f0b18a-f50e-499b-a50e-cba848507525",
  "Username": "Gamer123",
  "Email": "user@gmail.com",
  "Tier": "Free",
  "CreationDate": "2025-11-10T04:00:22+00:00"
}]
```

# Play endpoint


# New USER FLOW.



SideCar WebSocket API
========


