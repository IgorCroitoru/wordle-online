# Wordle Online - Production Deployment Guide

This guide covers deploying your Wordle Online monorepo to production using Docker Compose.

## 🚀 Quick Deployment

1. **Deploy to production:**
   ```bash
   yarn deploy
   ```

2. **Check status:**
   ```bash
   yarn deploy:status
   ```

3. **View logs:**
   ```bash
   yarn deploy:logs
   ```

## 📋 Pre-deployment Checklist

### Environment Configuration

1. **Create production environment files:**
   ```bash
   # Backend environment
   cp .env.production.example .env.production
   
   # Frontend environment  
   cp frontend/.env.production.example frontend/.env.production
   ```

2. **Update environment variables:**
   - Change default passwords
   - Set your domain name
   - Configure analytics IDs
   - Set secure JWT secrets

### SSL Certificates (Production)

1. **For Let's Encrypt certificates:**
   ```bash
   # Install certbot
   sudo apt install certbot
   
   # Generate certificates
   sudo certbot certonly --standalone -d your-domain.com
   
   # Copy certificates
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
   ```

2. **Update nginx.conf:**
   - Uncomment HTTPS server block
   - Change `your-domain.com` to your actual domain
   - Update frontend environment URLs to use HTTPS

## 🏗️ Architecture

### Production Stack
- **Frontend**: Next.js (standalone) behind nginx
- **Backend**: Node.js + Colyseus WebSocket server
- **Proxy**: Nginx with SSL termination, rate limiting, compression
- **Security**: Health checks, non-root users, security headers

### Network Flow
```
Internet → Nginx (Port 80/443) → Frontend (Port 3000) / Backend (Port 3001)
```

### Routing
- `/` → Frontend (Next.js app)
- `/api/*` → Backend API
- `/ws` → WebSocket (Colyseus)
- `/health`, `/rooms`, `/languages` → Backend endpoints

## 📊 Monitoring & Management

### Available Commands

| Command | Description |
|---------|-------------|
| `yarn deploy` | Build and deploy to production |
| `yarn deploy:logs` | View all service logs |
| `yarn deploy:status` | Check container status |
| `yarn deploy:restart` | Restart all services |
| `yarn deploy:stop` | Stop all services |
| `yarn docker:rebuild` | Rebuild from scratch |

### Health Checks

All services include health checks:
```bash
# Check service health
docker-compose ps

# Manual health checks
curl http://localhost/health    # Backend via nginx
curl http://localhost           # Frontend via nginx
```

### Log Management

```bash
# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend  
docker-compose logs -f nginx

# View last 100 lines
docker-compose logs --tail=100 backend
```

## 🔧 Configuration

### Nginx Configuration

The nginx configuration includes:
- **Rate Limiting**: 10 req/s for API, 30 req/s for frontend
- **Security Headers**: XSS protection, content type sniffing protection
- **Gzip Compression**: Automatic compression for text content
- **SSL Support**: Ready for HTTPS with proper certificates
- **WebSocket Support**: Proxy WebSocket connections to backend

### Docker Optimizations

- **Multi-stage builds**: Minimal production images
- **Non-root users**: Security best practices
- **Health checks**: Automatic restart on failure
- **Volume mounts**: Persistent data and SSL certificates
- **Networks**: Isolated container communication

## 🛡️ Security Features

### Container Security
- Non-root users in all containers
- Read-only file systems where possible
- Minimal attack surface with Alpine Linux

### Network Security
- Internal Docker network for service communication
- Only necessary ports exposed (80, 443)
- Rate limiting and DDoS protection

### Application Security
- CSP headers for XSS protection
- HTTPS redirect capability
- Secure WebSocket connections

## 🔍 Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check what's using ports 80/443
   netstat -tulpn | grep :80
   netstat -tulpn | grep :443
   ```

2. **SSL certificate issues:**
   ```bash
   # Check certificate validity
   openssl x509 -in ssl/cert.pem -text -noout
   
   # Test SSL connection
   openssl s_client -connect localhost:443
   ```

3. **Container startup issues:**
   ```bash
   # Check container logs
   docker-compose logs backend
   
   # Check resource usage
   docker stats
   ```

4. **Build failures:**
   ```bash
   # Clean rebuild
   yarn docker:clean
   yarn docker:rebuild
   ```

### Performance Optimization

1. **Enable nginx caching:**
   Add to nginx.conf for static content caching

2. **Database optimization:**
   If adding a database, use connection pooling

3. **Monitor resource usage:**
   ```bash
   docker stats
   htop
   ```

## 🚢 Deployment Strategies

### Blue-Green Deployment

1. **Create staging stack:**
   ```bash
   # Copy compose file
   cp docker-compose.yml docker-compose.staging.yml
   
   # Update ports in staging file
   # Deploy to staging first
   docker-compose -f docker-compose.staging.yml up -d
   ```

2. **Test staging environment**

3. **Switch production:**
   ```bash
   yarn deploy
   ```

### Rolling Updates

1. **Update backend only:**
   ```bash
   docker-compose up -d --no-deps backend
   ```

2. **Update frontend only:**
   ```bash
   docker-compose up -d --no-deps frontend
   ```

## 📈 Scaling

### Horizontal Scaling

1. **Multiple backend instances:**
   ```yaml
   backend:
     deploy:
       replicas: 3
   ```

2. **Load balancer configuration:**
   Update nginx upstream block

### Vertical Scaling

1. **Resource limits:**
   ```yaml
   backend:
     deploy:
       resources:
         limits:
           memory: 512M
           cpus: '0.5'
   ```

## 🔄 Backup & Recovery

### Data Backup
```bash
# Backup game data
tar -czf backup-$(date +%Y%m%d).tar.gz backend/data/

# Backup SSL certificates
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz ssl/
```

### Disaster Recovery
```bash
# Stop services
yarn deploy:stop

# Restore from backup
tar -xzf backup-20250627.tar.gz

# Restart services
yarn deploy
```

## 🌍 Domain & DNS Setup

### DNS Configuration
```
A record: your-domain.com → your-server-ip
CNAME: www.your-domain.com → your-domain.com
```

### Update Configuration
1. Update nginx.conf with your domain
2. Update environment variables
3. Generate SSL certificates for your domain
4. Restart services

Your Wordle Online game is now ready for production deployment! 🎮
