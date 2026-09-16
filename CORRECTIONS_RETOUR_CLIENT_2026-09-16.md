# Corrections du retour client GotFit — 16 septembre 2026

L'administration confirme désormais qu'approuver un compte coach déclenche son e-mail de validation. L'expédition est réalisée par l'API corrigée, également lorsque le statut est modifié depuis la fiche utilisateur ; répéter une approbation sans changement de statut ne renvoie pas l'e-mail.

Déployer l'API corrigée et vérifier sa configuration SMTP et sa file de traitement. Installer ce projet avec `npm ci`, compiler avec `npm run build`, puis déployer `dist` selon la procédure habituelle en conservant la configuration d'URL API du serveur.

Validation : compilation TypeScript/Vite et ESLint réussis. Le déclenchement de notification et l'absence de doublon sont testés côté API avec une notification simulée. Aucun e-mail réel n'a été envoyé pendant la vérification.
