# 🚀 Panduan Deployment ke VPS Ubuntu (Production Setup)

Panduan ini digunakan untuk memasang dan menjalankan **Sistem Inventaris PPMB** di VPS Linux (Ubuntu 22.04 / 24.04 LTS) agar berjalan 24 jam nonstop secara otomatis.

---

## 1. Persiapan VPS & Depedensi
Jalankan di terminal VPS Anda via SSH:

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x & Git & Nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git mysql-server

# Install PM2 Process Manager secara global
sudo npm install -g pm2
```

---

## 2. Setup Database MySQL di VPS

```bash
sudo mysql
```

Di dalam prompt MySQL, jalankan perintah:

```sql
CREATE DATABASE inventaris_pmb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pmb_user'@'localhost' IDENTIFIED BY 'PasswordRahasiaPPMB2026!';
GRANT ALL PRIVILEGES ON inventaris_pmb.* TO 'pmb_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Clone / Upload Proyek & Install Dependensi

Upload/copy folder proyek Anda ke `/var/www/project-inventaris-pmb`, lalu buka foldernya:

```bash
cd /var/www/project-inventaris-pmb
npm install
```

---

## 4. Konfigurasi `.env` Production

Buat file `.env`:

```bash
nano .env
```

Isikan kredensial VPS Anda:

```ini
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_USER=pmb_user
DB_PASSWORD=PasswordRahasiaPPMB2026!
DB_NAME=inventaris_pmb

JWT_SECRET=super_secret_pmb_2026_vps_production
```

Simpan file (`Ctrl + O`, `Enter`, lalu `Ctrl + X`).

---

## 5. Inisialisasi Database MySQL VPS

```bash
npm run init-db
```

---

## 6. Menjalankan Aplikasi 24/7 dengan PM2

```bash
# Jalankan aplikasi via PM2
pm2 start src/server.js --name "inventaris-pmb"

# Simpan proses agar otomatis berjalan saat VPS restart (reboot)
pm2 save
pm2 startup
```

Untuk melihat status aplikasi atau log di VPS:
```bash
pm2 status
pm2 logs inventaris-pmb
```

---

## 7. Setup Nginx Reverse Proxy (Akses via Domain / IP VPS)

Buat file konfigurasi Nginx:

```bash
sudo nano /etc/nginx/sites-available/inventaris-pmb
```

Isikan konfigurasi berikut (ganti `domain-anda.com` atau masukkan IP VPS):

```nginx
server {
    listen 80;
    server_name domain-anda.com; # atau IP VPS Anda

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi & restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/inventaris-pmb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Selesai! Aplikasi Web Dashboard kini dapat diakses melalui browser domain/IP VPS Anda.
