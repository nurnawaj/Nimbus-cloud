# ☁️ Nimbus — Personal Cloud Storage

A simplified Google Drive-style cloud storage application where users can register, securely log in, upload and manage files, organize them into folders, preview files, and share files using public links.

Built with **Node.js, Express.js, MongoDB Atlas, and GridFS**.

---

## 🚀 Features

- 🔐 User Registration & Login
- 🔑 JWT-based Authentication
- 🔒 Password Hashing with bcrypt
- 📤 Upload Files
- 📥 Download Files
- ✏️ Rename Files
- 🗑️ Delete Files
- 📁 Create & Manage Folders
- 🧭 Folder Navigation with Breadcrumbs
- 🔎 Search Files Across Folders
- 🖼️ Image Preview
- 📄 PDF Preview
- 🔗 Public File Sharing
- ⏳ Optional Share-Link Expiry
- 🚫 Revoke Shared Links
- 💾 Per-user Storage Quota
- 📊 Live Storage Usage Bar
- 📱 NFC Tag Sharing

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB Atlas
- MongoDB GridFS
- JWT
- bcrypt
- Multer

### Frontend
- HTML5
- CSS3
- JavaScript
- Fetch API

### Deployment
- Vercel
- MongoDB Atlas

---



##🔐 Authentication

Nimbus uses JWT (JSON Web Token) authentication.
When a user registers:
The password is hashed using bcrypt.
The hashed password is stored in MongoDB.
The original password is never stored.
After login:

User Login
     ↓
Verify Email & Password
     ↓
Generate JWT
     ↓
Store JWT in Browser
     ↓
Send JWT with Protected Requests

##💾 File Storage
Nimbus uses MongoDB GridFS for file storage.
Instead of using external storage services such as AWS S3 or Cloudinary, uploaded files are stored directly inside MongoDB Atlas.
GridFS automatically divides large files into smaller chunks.

##⚙️ Installation

git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd cloud-drive
npm install
##⚙️ Configuration & Run
1. Clone the Repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd cloud-drive

##2. Install Dependencies
npm install

##3. Create the Environment File
Create a .env file in the project root:
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000
MAX_STORAGE_MB=1024

Generate JWT Secret
Run:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Copy the generated value and put it in:
JWT_SECRET=your_generated_secret



##4. Configure MongoDB Atlas

Create a MongoDB Atlas account.
Create a free M0 cluster.
Create a database user.
Configure Network Access.
Copy your MongoDB connection string.
Add your connection string to .env.

Example:
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/cloudDrive?retryWrites=true&w=majority


5. Run the Application
Start the server:
npm start

The application will run at:
http://localhost:5000

Open the URL in your browser.

6. Development Mode
For automatic server restart during development:
npm run dev


7. Verify the Setup
If everything is configured correctly, the terminal should show something similar to:
✅ MongoDB Atlas connected
🚀 Cloud Drive server running at http://localhost:5000

Then open:
http://localhost:5000

Register an account and start uploading files.

🔧 Troubleshooting
MongoDB Connection Error
Check:

MONGODB_URI is correct.
MongoDB username and password are correct.
Your Atlas database user has read/write permissions.
Network Access allows your current IP.

Invalid or Expired Token
If you changed JWT_SECRET, previously generated JWT tokens will become invalid.
Simply log in again.
Upload Failed
Check:

File size is within the configured limit.
Your storage quota has not been exceeded.
MongoDB Atlas is connected correctly.

