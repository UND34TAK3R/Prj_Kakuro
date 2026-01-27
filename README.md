# 🧩 Kakuro Game

A modern take on the classic Kakuro logic-based number puzzle, enhanced with competitive, social, and customization features. Play casually offline or challenge others online while tracking your progress and improving your skills.

## ✨ Features

### Core Gameplay
- **Timer & Personal Best** - Track your completion time and challenge yourself to beat your best scores
- **Multiple Difficulty Levels** - Choose from various difficulty levels to match your skill
- **Gameplay Controls** - Reset game, pause/resume, restart, or quit at any time
- **Guided Learning** - In-game help via a Question Mark button explaining Kakuro rules

### Multiplayer & Competition
- **1v1 Multiplayer** - Compete against friends or players worldwide using real-time WebSocket communication
- **Rankings** - View leaderboards globally or among friends
- **Friend Search & Social Hub** (Online only) - Search for players, view profiles, and add or remove friends

### User Experience
- **User Accounts** - Login or sign up with email/password or Google Authentication, or play as a guest with offline features
- **User Settings** - Customize light/dark mode, profile picture, background music, and more
- **Security & Convenience** - Authentication, password reset, and secure account management

## 🛠 Tech Stack

- **Backend:** Java
- **Database:** Firebase
- **Frontend:** Angular

## 🌐 Online vs Offline Mode

### Offline Mode
- Guest play available
- Local gameplay features
- Personal timer and progress tracking

### Online Mode
Required for:
- 1v1 multiplayer matches
- Global and friends rankings
- Social hub features (friend search, profiles, adding friends)

All exceptions are handled gracefully for both offline and online scenarios to ensure a smooth user experience.

## 📋 Core Functionalities

### Account Management
- Create an account with email/password or Google Authentication
- Login to existing accounts
- Password reset functionality
- Guest mode for offline play
- Handles alternative flows and system exceptions gracefully

### Gameplay Features
- Play Kakuro puzzles with intuitive controls
- Reset current game
- Pause and resume functionality
- Restart puzzle
- View in-game rules and tutorials
- Online features (rankings, multiplayer) available when logged in

### Settings Management
- Customize user preferences:
  - Light/Dark mode toggle
  - Profile picture customization
  - Background music settings
- Reset settings to default

### Social Interaction (Online Only)
- View player profiles
- Add or remove friends
- Access global leaderboards
- View friends-only rankings
- Search for other players

## 🤝 Contributing

Justin Pescador, Derrick Mangari, Cong Huy Kieu

## 📧 Contact

*(Add contact information here)*
