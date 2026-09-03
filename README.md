# 🍱 HostelEats — Food Management System

A full-stack web application to manage hostel meals, reduce food waste, and streamline operations.

---

## 🚀 Tech Stack

| Layer      | Technology                      |
|------------|---------------------------------|
| Frontend   | HTML, CSS, Vanilla JavaScript   |
| Backend    | Node.js, Express.js             |
| Database   | MongoDB (Mongoose ODM)          |
| Auth       | JWT (JSON Web Tokens)           |
| Passwords  | bcryptjs                        |

---

## 📁 Project Structure

```
hostel-fms/
├── backend/
│   ├── models/
│   │   ├── User.js          # name, email, password, role, roomNumber
│   │   ├── Menu.js          # date, breakfast, lunch, dinner
│   │   ├── Booking.js       # userId, date, mealType, status
│   │   └── Feedback.js      # userId, mealType, date, rating, comment
│   ├── routes/
│   │   ├── auth.js          # POST /register, POST /login, GET /me
│   │   ├── menu.js          # GET/POST /menu, PUT/DELETE /menu/:id
│   │   ├── bookings.js      # book, cancel, my-meals, meal-count, attendance
│   │   ├── feedback.js      # POST /feedback, GET /feedbacks, GET /summary
│   │   └── admin.js         # dashboard stats, student management
│   ├── middleware/
│   │   └── auth.js          # JWT protect + adminOnly middleware
│   ├── server.js            # Express app entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html           # Login / Register page
│   ├── pages/
│   │   ├── student.html     # Student dashboard
│   │   └── admin.html       # Admin dashboard
│   ├── css/
│   │   ├── style.css        # Global styles + auth page
│   │   ├── dashboard.css    # Dashboard layout + components
│   │   └── admin.css        # Admin-specific overrides + modal
│   └── js/
│       ├── api.js           # Shared API fetch wrapper + utilities
│       ├── auth.js          # Login / Register logic
│       ├── student.js       # Student dashboard logic
│       └── admin.js         # Admin dashboard logic
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v16+
- MongoDB (local or MongoDB Atlas)

### Step 1 — Install dependencies
```bash
cd backend
npm install
```

### Step 2 — Configure environment
```bash
cp .env.example .env
# Edit .env and set your MONGO_URI and JWT_SECRET
```

**.env file:**
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/hostel_fms
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d
```

### Step 3 — Start the server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### Step 4 — Open the app
Visit: **http://localhost:5000**

---

## 🔑 Demo Accounts

To quickly test the app, register accounts manually or seed the DB:

| Role    | Email                  | Password    | Admin Code         |
|---------|------------------------|-------------|---------------------|
| Admin   | admin@hostel.com       | admin123    | HOSTEL_ADMIN_2024   |
| Student | student@hostel.com     | student123  | —                   |

**Register admin** by selecting "Admin" role on the register form and entering code: `HOSTEL_ADMIN_2024`

---

## 📡 API Endpoints

### Auth
| Method | Endpoint              | Access  | Description          |
|--------|-----------------------|---------|----------------------|
| POST   | `/api/auth/register`  | Public  | Register new user    |
| POST   | `/api/auth/login`     | Public  | Login, get JWT token |
| GET    | `/api/auth/me`        | Auth    | Get current user     |

### Menu
| Method | Endpoint         | Access  | Description              |
|--------|------------------|---------|--------------------------|
| GET    | `/api/menu`      | Auth    | Get menus (with filters) |
| GET    | `/api/menu/today`| Auth    | Get today's menu         |
| POST   | `/api/menu`      | Admin   | Create menu for a date   |
| PUT    | `/api/menu/:id`  | Admin   | Update a menu            |
| DELETE | `/api/menu/:id`  | Admin   | Delete a menu            |

### Bookings
| Method | Endpoint                      | Access  | Description                |
|--------|-------------------------------|---------|----------------------------|
| POST   | `/api/bookings/book-meal`     | Student | Book a meal                |
| PUT    | `/api/bookings/cancel`        | Student | Cancel a booking           |
| GET    | `/api/bookings/my-meals`      | Student | View own bookings          |
| GET    | `/api/bookings/meal-count`    | Admin   | Total meals booked by date |
| GET    | `/api/bookings/attendance`    | Admin   | Booked vs consumed stats   |
| PUT    | `/api/bookings/mark-consumed` | Admin   | Mark meal as consumed      |

### Feedback
| Method | Endpoint                | Access  | Description              |
|--------|-------------------------|---------|--------------------------|
| POST   | `/api/feedback`         | Student | Submit meal feedback     |
| GET    | `/api/feedback`         | Auth    | Get feedbacks            |
| GET    | `/api/feedback/summary` | Admin   | Average ratings per meal |

### Admin
| Method | Endpoint               | Access | Description         |
|--------|------------------------|--------|---------------------|
| GET    | `/api/admin/dashboard` | Admin  | Aggregated stats    |
| GET    | `/api/admin/students`  | Admin  | List all students   |
| DELETE | `/api/admin/students/:id` | Admin | Remove a student  |

---

## 🧩 Modules Summary

### 1. Authentication
- JWT-based login/register
- Role-based access: `student` and `admin`
- Passwords hashed with bcryptjs
- Protected routes via middleware

### 2. Menu Management (Admin)
- Create/update/delete weekly menus per date
- Breakfast, lunch, dinner items + timing
- View menus with date range filters

### 3. Meal Booking (Student)
- Book/cancel breakfast, lunch, or dinner for any date
- View booking history with status badges
- Prevents duplicate bookings

### 4. Meal Count Dashboard (Admin)
- See how many students booked each meal per day
- Visual bar charts on the dashboard

### 5. Attendance Tracking (Admin)
- Compare booked vs consumed vs cancelled
- Visualized per meal per day

### 6. Feedback System
- Students rate meals 1–5 stars with comments
- Admin views all feedback with filters
- Summary cards showing average ratings per meal type

---

## 🌐 Deployment (Production)

### Using MongoDB Atlas
1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Get your connection string
3. Set `MONGO_URI` in `.env` to your Atlas URI

### Deploy to Render / Railway / Heroku
1. Push your `backend/` folder
2. Set environment variables (`MONGO_URI`, `JWT_SECRET`, `PORT`)
3. Build command: `npm install`
4. Start command: `node server.js`

The Express server also serves the `frontend/` folder as static files, so everything runs from one process.

---

## 🔒 Security Notes
- Change `JWT_SECRET` to a long random string in production
- Change `HOSTEL_ADMIN_2024` admin code in `routes/auth.js`
- Consider adding rate limiting (`express-rate-limit`) for production
- Add HTTPS in production (handled by deployment platform)

---

## 📸 Screenshots

| Page | Description |
|------|-------------|
| `/` | Login & Register with animated background |
| `/pages/student.html` | Student: today's menu, booking, feedback |
| `/pages/admin.html` | Admin: dashboard, menu CRUD, attendance |
