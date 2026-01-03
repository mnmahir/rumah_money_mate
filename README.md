# 🏠 Rumah Money Mate

A modern, transparent expense tracking and bill-splitting application designed for shared living situations. Built with React, Node.js, and SQLite.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)

<a href='https://ko-fi.com/H2H818H9M3' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## ✨ Features

### Core Functionality
- 📊 **Interactive Dashboard** - Visualize expenses with charts, filter by time period or user
- 💰 **Expense Tracking** - Record expenses with categories, receipts, and notes
- 🔄 **Smart Bill Splitting** - Split expenses equally or by custom percentages (up to 7 decimals)
- 💳 **Payment Management** - Track who paid whom, with receipt attachments and confirmations
- 🔁 **Recurring Expenses** - Automate rent, utilities, and installment tracking
- 📈 **Utilities Tracking** - Monitor water and electricity usage trends

### User Experience
- 🎨 **Modern UI** - Beautiful glassmorphism dark purple theme
- 📱 **Responsive Design** - Works seamlessly on mobile and desktop
- 👥 **Full Transparency** - All members can view each other's records
- 🔔 **Real-time Updates** - See changes instantly

### Administration
- 👑 **Role-based Access** - Admin and regular user roles
- 🔐 **Secure Authentication** - JWT with refresh tokens, invitation-based registration
- 🔑 **Password Management** - Admins can reset user passwords
- 🗑️ **Safe Deletion** - Soft delete users with locked historical records
- 📤 **Data Export** - CSV and JSON backup functionality

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite with Prisma ORM |
| Authentication | JWT with refresh tokens |
| Charts | Chart.js, react-chartjs-2 |
| Process Manager | PM2 |

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mnmahir/rumah_money_mate.git
   cd rumah_money_mate
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Configure environment**
   ```bash
   cp server/.env.example server/.env
   ```
   
   Edit `server/.env` and change these values:
   ```env
   JWT_SECRET=your-secure-random-string
   JWT_REFRESH_SECRET=another-secure-random-string
   ADMIN_INVITATION_KEY=secret-key-for-admin-registration
   USER_INVITATION_KEY=secret-key-for-user-registration
   ```

4. **Initialize the database**
   ```bash
   cd server
   npx prisma db push
   npm run seed
   cd ..
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

### Default Admin Account

After seeding:
- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Change this password immediately!**

## 📁 Project Structure

```
house-finance/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── stores/        # Zustand state stores
│   │   └── lib/           # API client, utilities
│   └── dist/              # Production build (generated)
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── middleware/    # Auth, upload middleware
│   │   └── index.ts       # Server entry point
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── uploads/           # User uploaded files
├── deploy.sh              # Raspberry Pi deployment script
├── backup.sh              # Database backup script
├── ecosystem.config.js    # PM2 configuration
└── nginx.conf             # Nginx reverse proxy config
```

## 🖥️ Production Deployment

### Raspberry Pi / Ubuntu Server

1. **Run the deployment script**
   ```bash
   sudo ./deploy.sh
   ```
   
   This will:
   - Install Node.js, PM2, and Nginx
   - Build the application
   - Configure auto-start on boot
   - Set up reverse proxy

2. **Access your app**
   ```
   http://your-raspberry-pi-ip
   ```

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## 💾 Backup & Restore

### Create Backup
```bash
./backup.sh
```

Backups are stored in `/backups/` and include:
- Database (`.db`)
- Uploads (receipts, avatars, QR codes)
- Environment configuration

### Restore from Backup
```bash
# Stop the app
pm2 stop rumah-money-mate

# Restore database
cp backups/house_finance_TIMESTAMP.db server/prisma/house_finance.db

# Restore uploads
tar -xzf backups/uploads_TIMESTAMP.tar.gz -C server/

# Restart
pm2 restart rumah-money-mate
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run setup` | Install all dependencies |
| `npm run dev` | Start development servers |
| `npm run build` | Build for production |
| `npm run seed` | Seed database with defaults (in server/) |
| `./backup.sh` | Create database backup |
| `./deploy.sh` | Deploy to Raspberry Pi |
| `./reset-database.sh` | Reset database (with warnings) |

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id/status` - Confirm/reject payment

### Users
- `GET /api/users` - List users
- `PUT /api/users/profile` - Update profile
- `DELETE /api/users/:id` - Delete user (admin)

### Dashboard
- `GET /api/dashboard/summary` - Get summary stats
- `GET /api/dashboard/balances` - Get who owes who

## 🔒 Security Features

- **JWT Authentication** with secure refresh tokens
- **Invitation-based Registration** - No open signups
- **Password Hashing** with bcrypt
- **Admin-only Actions** - Delete, edit protected operations
- **Soft Delete** - User data preserved for audit trail
- **Locked Records** - Historical records cannot be modified

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for shared house expense management
- Designed for transparency and ease of use
- Optimized for Raspberry Pi deployment

---

Made with ❤️ by [Mahir Sehmi](https://github.com/mnmahir) for housemates everywhere
