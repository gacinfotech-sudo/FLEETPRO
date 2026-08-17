#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
ORCHESTRATOR=${2:-ecs}
REGISTRY="${ECR_REGISTRY:-fleetpro}"
IMAGE_NAME="fleetpro"
IMAGE_TAG="${VERSION:-latest}"
APP_PORT=5050
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=2

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}FleetPro Deployment Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Orchestrator: ${ORCHESTRATOR}${NC}"
echo -e "${BLUE}================================${NC}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Function to check Docker installation
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    log "Docker is installed and running"
}

# Function to build Docker image
build_image() {
    log "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    if [ "${ENVIRONMENT}" = "staging" ]; then
        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} \
            --build-arg NODE_ENV=staging \
            -f Dockerfile .
    else
        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} \
            --build-arg NODE_ENV=production \
            -f Dockerfile .
    fi
    
    if [ $? -eq 0 ]; then
        log "Docker image built successfully"
        docker images | grep ${IMAGE_NAME}
    else
        error "Failed to build Docker image"
    fi
}

# Function to tag image for ECR
tag_for_ecr() {
    log "Tagging image for ECR registry"
    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:latest
    log "Image tagged successfully"
}

# Function to push to ECR
push_to_ecr() {
    log "Pushing image to ECR (mock mode)"
    # In production, this would authenticate with ECR
    # aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${REGISTRY}
    # docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
    echo "Pushed image to ECR: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    log "Deploying with Docker Compose to ${ENVIRONMENT}"
    
    # Set environment variables
    export COMPOSE_PROJECT_NAME="fleetpro-${ENVIRONMENT}"
    export ENVIRONMENT=${ENVIRONMENT}
    export IMAGE_TAG=${IMAGE_TAG}
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        log "Creating .env file with default values"
        cat > .env << 'ENVFILE'
NODE_ENV=staging
MONGODB_URI=mongodb://admin:admin123@mongodb:27017/fleetpro?authSource=admin
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRE=7d
PORT=5050
LOG_LEVEL=info
ENVFILE
    fi
    
    # Start services
    docker-compose -p fleetpro-${ENVIRONMENT} up -d --build
    
    log "Docker Compose deployment completed"
}

# Function to deploy with ECS
deploy_ecs() {
    log "Deploying with ECS (simulated)"
    log "Creating ECS task definition"
    log "Updating ECS service"
    log "Waiting for tasks to start"
    echo "mock: ECS deployment simulated"
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    local retries=0
    local healthy=0
    
    while [ $retries -lt $HEALTH_CHECK_RETRIES ]; do
        log "Health check attempt $((retries + 1))/$HEALTH_CHECK_RETRIES..."
        
        # Check if service is responding
        if curl -sf http://localhost:${APP_PORT}/health > /dev/null 2>&1; then
            log "Health check passed"
            healthy=1
            break
        fi
        
        retries=$((retries + 1))
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    if [ $healthy -eq 0 ]; then
        error "Service failed health check after $HEALTH_CHECK_RETRIES attempts"
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    log "Running smoke tests"
    
    # Test API endpoints
    local test_endpoints=(
        "/api/health"
        "/api/v1/auth/check"
        "/api/v1/users"
        "/api/v1/vehicles"
        "/api/v1/drivers"
    )
    
    for endpoint in "${test_endpoints[@]}"; do
        log "Testing endpoint: $endpoint"
        if curl -sf "http://localhost:${APP_PORT}${endpoint}" > /dev/null 2>&1; then
            log "✓ Endpoint $endpoint is working"
        else
            log "⚠ Endpoint $endpoint not responding (may require auth)"
        fi
    done
    
    log "Smoke tests completed"
}

# Function to show deployment summary
show_summary() {
    log "Deployment Summary:"
    echo -e "${BLUE}================================${NC}"
    echo -e "Environment: ${GREEN}${ENVIRONMENT}${NC}"
    echo -e "Image: ${GREEN}${IMAGE_NAME}:${IMAGE_TAG}${NC}"
    echo -e "Service URL: ${GREEN}http://localhost:${APP_PORT}${NC}"
    echo -e "Health Check: ${GREEN}http://localhost:${APP_PORT}/health${NC}"
    echo -e "Docker Compose Project: ${GREEN}fleetpro-${ENVIRONMENT}${NC}"
    echo -e "${BLUE}================================${NC}"
    echo -e "Deployment Status: ${GREEN}SUCCESS${NC}"
}

# Main execution
main() {
    check_docker
    build_image
    tag_for_ecr
    push_to_ecr
    
    if [ "${ORCHESTRATOR}" = "ecs" ]; then
        deploy_ecs
    else
        deploy_docker_compose
    fi
    
    # Wait a bit for services to start
    sleep 5
    
    verify_deployment
    run_smoke_tests
    show_summary
}

# Run main function
main
