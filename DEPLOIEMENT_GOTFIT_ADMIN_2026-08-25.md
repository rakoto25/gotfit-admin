# Déploiement de GotFit Admin sur le VPS

Répertoire prévu : `/var/www/gotfit-admin`.

## 1. Vérifier la configuration

```bash
cd /var/www/gotfit-admin
grep '^VITE_API_URL=' .env.production .env.local 2>/dev/null
```

La valeur de production attendue est généralement :

```env
VITE_API_URL=https://api.gotfit.tech/api
```

Sauvegarder le fichier existant avant toute mise à jour :

```bash
[ -f .env.production ] && cp -a .env.production /root/gotfit-admin.env.production.$(date +%F-%H%M%S)
[ -f .env.local ] && cp -a .env.local /root/gotfit-admin.env.local.$(date +%F-%H%M%S)
```

## 2. Mettre à jour le code Git

Exécuter Git avec le propriétaire du dépôt :

```bash
cd /var/www/gotfit-admin
stat -c '%U:%G %n' . .git
sudo -u deploy -H git status --short
sudo -u deploy -H git fetch origin main
sudo -u deploy -H git merge --ff-only origin/main
sudo -u deploy -H git rev-parse --short HEAD
```

Si `.git/config` appartient à `root`, corriger uniquement le dossier Git :

```bash
chown -R deploy:www-data /var/www/gotfit-admin/.git
```

## 3. Installer et compiler

Si une ancienne installation a été créée par `root`, corriger les dossiers de build avant de lancer npm :

```bash
[ -d /var/www/gotfit-admin/node_modules ] && chown -R deploy:www-data /var/www/gotfit-admin/node_modules
[ -d /var/www/gotfit-admin/dist ] && chown -R deploy:www-data /var/www/gotfit-admin/dist
```

Puis compiler en tant que `deploy` :

```bash
sudo -u deploy -H bash -lc '
  cd /var/www/gotfit-admin
  node -v
  npm ci
  npm run lint
  npm run build
'
```

Vérifier le résultat avant de recharger Nginx :

```bash
test -f /var/www/gotfit-admin/dist/index.html \
  && echo 'Build admin présent' \
  || echo 'Build absent : ne pas continuer'
```

## 4. Recharger Nginx et contrôler

Pour un front Vite statique, aucun service Node/PM2 n’est nécessaire : Nginx doit servir le dossier `dist`.

```bash
nginx -t
systemctl reload nginx
```

Contrôler ensuite le domaine admin réel :

```bash
curl -sS -o /dev/null -w 'ADMIN HTTP %{http_code}\n' https://admin.gotfit.tech/
```

Si le domaine utilisé n’est pas `admin.gotfit.tech`, remplacer simplement cette URL dans la dernière commande.

## 5. Point Nginx important pour React Router

Le bloc du site admin doit contenir un fallback vers `index.html` :

```nginx
root /var/www/gotfit-admin/dist;

location / {
    try_files $uri $uri/ /index.html;
}
```

Sans ce fallback, le rechargement direct de `/annonces`, `/paiements` ou `/users` renverra une erreur 404.
