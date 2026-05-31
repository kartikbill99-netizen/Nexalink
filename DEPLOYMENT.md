# 🚀 Nexalink Deployment Guide

Complete guide to deploying Nexalink to production with various hosting platforms.

---

## 📋 Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] Database tables created in Supabase (SQL setup completed)
- [ ] RLS policies enabled on all tables
- [ ] Storage buckets (`avatars`, `banners`) created and public
- [ ] Google OAuth configured in Supabase and Google Cloud Console
- [ ] Email domain configured in Supabase Auth settings
- [ ] Production Supabase credentials obtained
- [ ] Domain/URL finalized
- [ ] HTTPS/SSL certificate obtained
- [ ] Tested all main features locally
- [ ] Removed all `console.log()` debug statements
- [ ] Set `DEBUG: false` in config.js
- [ ] Verified `.gitignore` protects secrets

---

## 🔑 Environment Configuration

### Option 1: Direct in config.js (Simple)
```javascript
// js/config.js
window.NEXALINK_CONFIG = {
  SUPABASE_URL: 'https://your-prod-project.supabase.co',
  SUPABASE_ANON_KEY: 'your_prod_anon_key_here',
  DEBUG: false
};
```

**Pros**: Simple, no build step needed  
**Cons**: Keys visible in source code (but this is safe by design)

### Option 2: Environment Variables (Recommended)
```bash
# .env.production
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_prod_anon_key_here
```

Then update `js/config.js`:
```javascript
window.NEXALINK_CONFIG = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  DEBUG: false
};
```

Requires build tool (Vite, Webpack, etc.)

### Option 3: Runtime Environment (Most Secure)
```html
<!-- In index.html -->
<script>
  window.NEXALINK_CONFIG = {
    SUPABASE_URL: window.env?.SUPABASE_URL || 'https://...',
    SUPABASE_ANON_KEY: window.env?.SUPABASE_ANON_KEY || 'sb_...',
    DEBUG: false
  };
</script>
```

Set environment variables on hosting platform, they become `window.env`.

---

## 🌐 Deployment Platforms

### Vercel (Recommended for Serverless)

#### Using Git (Easiest)
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Set environment variables:
   ```
   VITE_SUPABASE_URL=https://...
   VITE_SUPABASE_ANON_KEY=sb_...
   ```
6. Click "Deploy"

#### Using CLI
```bash
npm install -g vercel
vercel login
vercel
# Follow prompts, set env variables
vercel --prod  # Production deployment
```

#### Vercel Configuration (`vercel.json`)
```json
{
  "buildCommand": "npm run build || echo 'No build needed'",
  "outputDirectory": ".",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

**Pros**: 
- Free tier available
- Easy deployment
- Global CDN
- Automatic HTTPS

**Cons**: 
- Build cost if using paid tier
- May need for serverless functions

---

### Netlify (Recommended for Static)

#### Using Git
1. Push to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "New site from Git"
4. Select repository
5. Leave build settings empty (no build needed)
6. Add environment variables:
   ```
   SUPABASE_URL = https://...
   SUPABASE_ANON_KEY = sb_...
   ```
7. Deploy

#### Using CLI
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir .
```

#### Netlify Configuration (`netlify.toml`)
```toml
[build]
command = "echo 'No build needed'"
publish = "."

[[redirects]]
from = "/*"
to = "/index.html"
status = 200

[context.production.environment]
SUPABASE_URL = "https://..."
SUPABASE_ANON_KEY = "sb_..."
```

**Pros**:
- Excellent for static sites
- Free tier generous
- Simple deployment
- Good build controls

**Cons**:
- Redirect rules required for SPA
- Less suited for serverless

---

### GitHub Pages (Free)

```bash
# 1. Create gh-pages branch
git checkout -b gh-pages

# 2. Update config for GitHub Pages URL
# If repo is username/nexalink, set base:
# In js/config.js add:
# APP_URL: 'https://username.github.io/nexalink/'

# 3. Push to gh-pages
git push origin gh-pages

# 4. Enable in GitHub Settings:
# Settings → Pages → Source → gh-pages branch
```

**Pros**: 
- Completely free
- No configuration needed
- GitHub integrated

**Cons**: 
- Limited to GitHub users
- Public repositories only (on free tier)
- No custom functions

---

### Traditional Hosting (cPanel, VPS, etc.)

#### Using FTP
1. Connect to hosting via FTP client (FileZilla, Cyberduck)
2. Upload entire `nexalink/` folder to web root (`public_html/`)
3. Ensure `index.html` is in the root directory
4. Update config.js with production credentials
5. Set up HTTPS (through hosting panel or Let's Encrypt)

#### Using SSH
```bash
# Connect to server
ssh user@your-domain.com

# Navigate to web root
cd public_html/

# Clone or upload files
git clone https://github.com/yourusername/nexalink.git
# or
scp -r nexalink/ user@your-domain.com:~/public_html/

# Set permissions
chmod 755 .
chmod 644 *.html *.css
chmod 644 js/*.js
```

#### Apache Configuration (`.htaccess`)
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Route all requests to index.html (SPA)
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
  
  # Force HTTPS
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

#### Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name nexalink.yourdomain.com;
    root /var/www/nexalink;
    
    ssl_certificate /path/to/ssl.crt;
    ssl_certificate_key /path/to/ssl.key;
    
    # SPA routing
    location / {
        try_files $uri /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Pros**:
- Full control
- No vendor lock-in
- Potentially cheaper long-term

**Cons**:
- More technical setup
- Server maintenance required
- You manage SSL/HTTPS

---

### Docker (Advanced)

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY . .

# No build needed for vanilla JS
# But you could optimize CSS/JS here

EXPOSE 3000

# Serve with simple HTTP server
CMD ["npx", "http-server", "-p", "3000", "--cache", "3600"]
```

#### docker-compose.yml
```yaml
version: '3.8'
services:
  nexalink:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    volumes:
      - ./:/app
      - /app/node_modules
```

```bash
# Build and run
docker build -t nexalink .
docker run -p 3000:3000 nexalink

# Or with compose
docker-compose up
```

---

## 🔐 HTTPS/SSL Setup

### Free SSL with Let's Encrypt

#### Certbot (Nginx/Apache)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --webroot -w /var/www/nexalink -d nexalink.yourdomain.com

# Auto-renew
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### CloudFlare (Recommended)
1. Point domain to CloudFlare nameservers
2. Set SSL mode to "Full" or "Full (Strict)"
3. CloudFlare handles certificate automatically
4. Also provides free CDN and DDoS protection

---

## 📊 Setting Up Monitoring

### Error Tracking (Sentry)

```javascript
// In js/config.js or index.html
if (window.location.hostname !== 'localhost') {
  Sentry.init({
    dsn: 'your-sentry-dsn',
    environment: 'production',
    tracesSampleRate: 0.1,
  });
}
```

```html
<!-- In index.html <head> -->
<script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>
```

### Analytics (Google Analytics)

```html
<!-- In index.html <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Uptime Monitoring
Use free services:
- [UptimeRobot](https://uptimerobot.com) — Free tier
- [StatusUp](https://www.statusup.com) — Monitors and reports
- [Pingdom](https://www.pingdom.com) — Free tier

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### GitLab CI
```yaml
# .gitlab-ci.yml
deploy:
  stage: deploy
  script:
    - npm install -g vercel
    - vercel --token $VERCEL_TOKEN --prod
  only:
    - main
```

---

## 📈 Performance Optimization

### Pre-deployment Steps

1. **Minify CSS/JS**
   ```bash
   # Using minify
   npm install -g minify
   minify css/styles.css > css/styles.min.css
   minify js/auth.js > js/auth.min.js
   # Then update HTML to reference .min files
   ```

2. **Optimize Images**
   - Compress avatars/banners with [TinyPNG](https://tinypng.com)
   - Convert to WebP format
   - Use responsive image sizes

3. **Lazy Load**
   ```html
   <img src="..." loading="lazy">
   ```

4. **Gzip Compression**
   - Most hosting providers handle this
   - Verify with: `curl -I https://yoursite.com | grep encoding`

5. **Caching Headers**
   ```nginx
   # In Nginx config
   add_header Cache-Control "public, max-age=31536000" for *.js, *.css
   add_header Cache-Control "public, max-age=3600" for *.html
   ```

---

## 🧪 Testing Before Deployment

### Test Checklist
- [ ] Auth works (signup, login, OAuth)
- [ ] Profile loads and saves
- [ ] Images upload correctly
- [ ] Feed loads with real users
- [ ] Search works
- [ ] Messages send/receive
- [ ] Calling initiates and connects
- [ ] Help tickets submit
- [ ] Responsive design works on mobile
- [ ] No console errors or warnings
- [ ] Performance is acceptable (Lighthouse > 80)

### Lighthouse Audit
```bash
# Using npm
npm install -g lighthouse
lighthouse https://yoursite.com --view
```

---

## 📞 Post-Deployment Support

### Monitor Logs
```bash
# Vercel
vercel logs

# Netlify
netlify logs:tail

# Traditional hosting
ssh user@host
tail -f /var/log/nginx/error.log
tail -f /var/log/apache2/error.log
```

### Database Backups
```bash
# Supabase automated backups (enabled by default)
# Or manual backup:
pg_dump postgres://user:pass@host/db > backup.sql
```

### Update Dependencies
```bash
# Check for updates
npm outdated

# Update safely
npm update
npm audit fix
```

---

## 🆘 Common Deployment Issues

### "404 on page refresh"
**Cause**: SPA routing not configured  
**Solution**: 
- Netlify: Add redirect rule in netlify.toml
- Apache: Add .htaccess RewriteRule
- Nginx: Add try_files directive

### "CORS error in production"
**Cause**: Supabase Site URL not set correctly  
**Solution**: 
- Supabase → Auth Settings → Site URL = your production domain

### "Google OAuth redirect failed"
**Cause**: Redirect URL not in Google Console or Supabase  
**Solution**:
- Add `https://yourdomain.com` to both Supabase and Google Cloud Console

### "Images not loading"
**Cause**: Storage URL misconfigured or CORS issue  
**Solution**:
- Verify bucket is public
- Check image URLs in browser (copy URL directly)
- Check Storage CORS settings in Supabase

### "Realtime not working"
**Cause**: Realtime not enabled or connection dropped  
**Solution**:
- Enable Realtime in Supabase project settings
- Check browser WebSocket connection (DevTools → Network)
- Verify RLS policies allow access

---

## 📈 Scaling Considerations

For future growth:

### Database
- Upgrade to higher tier if approaching connection limits
- Archive old messages/calls to reduce table size
- Add indexes on frequently searched columns

### Storage
- Monitor file uploads (1GB+ plan needed)
- Implement automatic image optimization
- Consider external CDN (CloudFlare, ImageKit)

### Realtime
- Supabase Realtime scales automatically
- Monitor active connection count
- Filter channels to avoid broadcasting to all users

### Serverless Functions
- Add edge functions for validation
- Implement rate limiting
- Monitor function execution time

---

## ✅ Deployment Complete!

Once deployed:
1. ✅ Test all features in production
2. ✅ Share domain with users
3. ✅ Monitor logs for errors
4. ✅ Set up automated backups
5. ✅ Plan future scaling

**Congratulations! Nexalink is live! 🎉**

For deployment help: Check the [README.md](README.md#-support) support section.
