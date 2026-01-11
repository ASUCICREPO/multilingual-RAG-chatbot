# NASWA Website Mockup

A Next.js mockup inspired by the NASWA website design with similar layout and styling.

## Features

- Responsive header with navigation
- Hero section with Winter Policy Forum banner
- Side event panels
- Content cards section
- Interactive feedback widget

## Installation & Setup

This project comes as a source code package. You'll need to install dependencies before running it.

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 18.0 or higher)
- **npm** (comes with Node.js) or **yarn**

You can check your versions by running:
```bash
node --version
npm --version
```

## Getting Started

### 1. Extract the Project

Extract the zip file to your desired location:

```bash
unzip naswa-mockup.zip
cd naswa-mockup
```

### 2. Install Dependencies

```bash
npm install
```

This will install all the required dependencies including:
- Next.js 16.0.7
- React 19
- TypeScript
- Tailwind CSS 3.4.0
- PostCSS and Autoprefixer

### 3. Run the Development Server

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

### 4. Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000) in your web browser to view the application.

## Available Scripts

In the project directory, you can run:

- `npm run dev` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm run start` - Runs the built app in production mode
- `npm run lint` - Runs ESLint to check for code issues

## Tech Stack

- **Next.js 16.0.7** - React framework with Turbopack
- **React 19** - JavaScript library for building user interfaces
- **TypeScript** - Typed superset of JavaScript
- **Tailwind CSS 3.4.0** - Utility-first CSS framework
- **PostCSS** - CSS post-processor
- **ESLint** - Code linting tool

## Project Structure

```
naswa-mockup/
├── app/
│   ├── components/
│   │   ├── Header.tsx          # Top navigation and branding
│   │   ├── Hero.tsx            # Main banner section
│   │   ├── ContentCards.tsx    # Feature cards grid
│   │   └── FeedbackWidget.tsx  # Floating feedback widget
│   ├── globals.css             # Global styles and Tailwind imports
│   ├── layout.tsx              # Root layout component
│   └── page.tsx                # Main page component
├── public/                     # Static assets
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Project dependencies and scripts
```

## Configuration Files

### Tailwind CSS
The project uses Tailwind CSS for styling. Configuration is in `tailwind.config.js` and styles are imported in `app/globals.css`.

### TypeScript
TypeScript configuration is in `tsconfig.json` with Next.js optimized settings.

### PostCSS
PostCSS processes the CSS with Tailwind and Autoprefixer plugins configured in `postcss.config.js`.

## Development

### Making Changes
- Edit components in the `app/components/` directory
- Modify styles using Tailwind CSS classes
- The development server supports hot reloading for instant updates

### Adding New Components
1. Create new `.tsx` files in `app/components/`
2. Import and use them in `page.tsx` or other components
3. Follow the existing TypeScript and React patterns

## Troubleshooting

### CSS Not Loading
If styles aren't appearing:
1. Ensure Tailwind CSS is properly configured
2. Check that `@tailwind` directives are in `globals.css`
3. Restart the development server: `npm run dev`

### Port Already in Use
If port 3000 is busy:
```bash
npm run dev -- -p 3001
```

### Dependencies Issues
If you encounter dependency conflicts:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Package Contents

This zip package includes:
- Source code (app/, public/ directories)
- Configuration files (package.json, tsconfig.json, etc.)
- Documentation (README.md)
- **Excludes**: node_modules, .next build cache, .git history

After extraction, you'll need to run `npm install` to download dependencies.

## Browser Support

This application supports all modern browsers including:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for demonstration purposes.
