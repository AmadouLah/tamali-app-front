# Configuration Vercel

## Variables d'environnement

Dans Vercel, configurez la variable d'environnement suivante :

- `NG_APP_API_URL` : URL complète de votre API backend (ex: `https://votre-backend.vercel.app/api`)

## Déploiement

1. Connectez votre repository à Vercel
2. Configurez la variable d'environnement `NG_APP_API_URL` dans les paramètres du projet
3. Vercel détectera automatiquement le fichier `vercel.json` et utilisera la configuration de build

## Build

Le build de production utilise automatiquement `environment.prod.ts` qui lit la variable `NG_APP_API_URL`.
