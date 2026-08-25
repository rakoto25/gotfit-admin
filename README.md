# GotFit Operations

Console d’administration React/Vite connectée à l’API Laravel GotFit.

## Fonctionnalités

- tableau de bord alimenté par les indicateurs réels de Laravel ;
- validation, refus et suppression des annonces coachs et demandes clients ;
- validation des prestations, résolution des litiges, remboursements et reversements Stripe Connect ;
- contrôle des documents professionnels avec motif de refus ;
- validation, suspension et gestion des comptes, des rôles et du SIRET ;
- pagination des utilisateurs et téléchargement des diplômes depuis le dossier coach ;
- réglage des frais client et de la commission coach ;
- messagerie individuelle et diffusion groupée aux coachs ;
- interface responsive dédiée aux opérations administratives.

## Configuration

Copier `.env.example` vers `.env.production` puis adapter l’URL :

```env
VITE_API_URL=https://api.gotfit.tech/api
```

L’URL doit se terminer par `/api`. Le token Laravel Sanctum est ajouté automatiquement aux requêtes.

## Développement et contrôle

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Le build de production est généré dans `dist/`.

## Routes Laravel utilisées

La console repose sur les routes admin déjà présentes dans le dépôt `gotfit` :

- `/admin/dashboard`, `/users` et `/users/{id}/validate` ;
- `/getAllAnnonce`, `/annonces/{id}/valide` et `/annonces/{id}/refuser` ;
- `/documents`, `/documents/{id}/valider` et `/documents/{id}/refuser` ;
- `/reservation/all`, `/validate-prestation`, `/transfer-to-coach`, `/refund` et `/resolve-dispute` ;
- `/admin/payments` et `/admin/business-settings` ;
- `/admin/messages` et `/admin/messages/broadcast-coaches`.

Toutes les opérations sensibles restent contrôlées côté Laravel par `auth:sanctum` et le rôle administrateur.

Consulter `DEPLOIEMENT_GOTFIT_ADMIN_2026-08-25.md` pour la mise en production sur le VPS.
