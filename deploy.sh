#!/bin/bash

# Business Scraper Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-development}
PROJECT_NAME="business-scraper"

echo "🚀 Deploying Business Scraper to $ENVIRONMENT environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment files..."
    
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        log_warning "Created backend/.env from example. Please configure it before running."
    fi
    
    if [ ! -f "frontend/.env.local" ]; then
        echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > frontend/.env.local
        log_success "Created frontend/.env.local"
    fi
}

# Build and start services
deploy_services() {
    log_info "Building and starting services..."
    
    # Stop existing services
    docker-compose down
    
    # Build images
    log_info "Building Docker images..."
    docker-compose build --no-cache
    
    # Start services
    log_info "Starting services..."
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f docker-compose.yml up -d
    else
        docker-compose up -d
    fi
    
    log_success "Services started successfully"
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    # Wait for database
    log_info "Waiting for MongoDB..."
    sleep 10
    
    # Wait for Redis
    log_info "Waiting for Redis..."
    sleep 5
    
    # Wait for backend
    log_info "Waiting for backend API..."
    for i in {1..30}; do
        if curl -f http://localhost:3001/health &>/dev/null; then
            log_success "Backend API is ready"
            break
        fi
        sleep 2
    done
    
    # Wait for frontend
    log_info "Waiting for frontend..."
    for i in {1..30}; do
        if curl -f http://localhost:3000 &>/dev/null; then
            log_success "Frontend is ready"
            break
        fi
        sleep 2
    done
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    # Check backend health
    if curl -f http://localhost:3001/health &>/dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Check database connection
    if docker exec business-scraper-db mongo --eval "db.adminCommand('ping')" &>/dev/null; then
        log_success "Database health check passed"
    else
        log_error "Database health check failed"
        return 1
    fi
    
    # Check Redis connection
    if docker exec business-scraper-redis redis-cli ping &>/dev/null; then
        log_success "Redis health check passed"
    else
        log_error "Redis health check failed"
        return 1
    fi
    
    log_success "All health checks passed"
}

# Show service status
show_status() {
    log_info "Service Status:"
    docker-compose ps
    
    echo ""
    log_info "Access URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:3001"
    echo "  MongoDB: mongodb://localhost:27017"
    echo "  Redis: localhost:6379"
    
    echo ""
    log_info "Demo Account:"
    echo "  Email: demo@businessscraper.com"
    echo "  Password: demo123"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    docker-compose down
    docker system prune -f
    log_success "Cleanup completed"
}

# Main deployment flow
main() {
    echo "🏗️  Business Scraper Deployment"
    echo "================================"
    
    case "$1" in
        "cleanup")
            cleanup
            ;;
        "status")
            show_status
            ;;
        *)
            check_prerequisites
            setup_environment
            deploy_services
            wait_for_services
            health_check
            show_status
            
            log_success "🎉 Deployment completed successfully!"
            ;;
    esac
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"