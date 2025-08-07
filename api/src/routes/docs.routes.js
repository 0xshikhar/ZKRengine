const express = require('express');
const path = require('path');

const router = express.Router();

// API Documentation
router.get('/', (req, res) => {
    res.json({
        name: 'ZKRandom API',
        version: '1.0.0',
        description: 'Zero-Knowledge Random Number Generation API',
        endpoints: {
            '/api/randomness': {
                description: 'Randomness request endpoints',
                methods: {
                    'POST /request': 'Request a new random number',
                    'GET /request/:requestId': 'Get request status',
                    'GET /user/:address': 'Get user requests',
                    'GET /statistics': 'Get system statistics',
                    'GET /chains': 'Get supported chains',
                    'GET /chains/:chainId': 'Get chain information'
                }
            },
            '/api/admin': {
                description: 'Admin endpoints (requires API key)',
                methods: {
                    'GET /statistics': 'Get detailed system statistics',
                    'GET /requests/pending': 'Get pending requests',
                    'GET /requests/failed': 'Get failed requests',
                    'POST /requests/:requestId/retry': 'Retry failed request',
                    'PUT /chains/:chainId': 'Update chain configuration',
                    'GET /logs': 'Get system logs',
                    'POST /maintenance': 'Toggle maintenance mode'
                }
            },
            '/api/health': {
                description: 'Health check endpoints',
                methods: {
                    'GET /health': 'Comprehensive health check',
                    'GET /ready': 'Readiness probe',
                    'GET /live': 'Liveness probe',
                    'GET /metrics': 'Prometheus metrics'
                }
            }
        },
        authentication: {
            'Admin endpoints': 'Require X-API-Key header',
            'User endpoints': 'No authentication required'
        },
        rate_limiting: {
            'General API': '100 requests per 15 minutes',
            'Randomness requests': '10 requests per hour',
            'Proof generation': '5 requests per hour'
        }
    });
});

// OpenAPI/Swagger documentation
router.get('/swagger', (req, res) => {
    res.json({
        openapi: '3.0.0',
        info: {
            title: 'ZKRandom API',
            version: '1.0.0',
            description: 'Zero-Knowledge Random Number Generation API'
        },
        servers: [
            {
                url: process.env.API_BASE_URL || 'http://localhost:3000',
                description: 'Development server'
            }
        ],
        paths: {
            '/api/randomness/request': {
                post: {
                    summary: 'Request a new random number',
                    tags: ['Randomness'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['chainId', 'seed', 'requester'],
                                    properties: {
                                        chainId: {
                                            type: 'integer',
                                            description: 'Chain ID to request randomness for'
                                        },
                                        seed: {
                                            type: 'string',
                                            description: '32-byte hex seed for randomness'
                                        },
                                        requester: {
                                            type: 'string',
                                            description: 'Ethereum address of requester'
                                        },
                                        callbackAddress: {
                                            type: 'string',
                                            description: 'Optional callback address'
                                        },
                                        feePaid: {
                                            type: 'string',
                                            description: 'Fee paid for the request'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Request created successfully',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: {
                                                type: 'object',
                                                properties: {
                                                    requestId: { type: 'string' },
                                                    status: { type: 'string' },
                                                    estimatedTime: { type: 'integer' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        '400': {
                            description: 'Validation error'
                        },
                        '429': {
                            description: 'Rate limit exceeded'
                        }
                    }
                }
            },
            '/api/randomness/request/{requestId}': {
                get: {
                    summary: 'Get request status',
                    tags: ['Randomness'],
                    parameters: [
                        {
                            name: 'requestId',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Request status retrieved',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: {
                                                type: 'object',
                                                properties: {
                                                    requestId: { type: 'string' },
                                                    status: { type: 'string' },
                                                    randomValue: { type: 'string' },
                                                    proofHash: { type: 'string' },
                                                    fulfilledAt: { type: 'string' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        '404': {
                            description: 'Request not found'
                        }
                    }
                }
            }
        },
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key'
                }
            }
        }
    });
});

// API Examples
router.get('/examples', (req, res) => {
    res.json({
        examples: {
            'Request Randomness': {
                method: 'POST',
                url: '/api/randomness/request',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    chainId: 84532,
                    seed: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                    requester: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
                    callbackAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
                    feePaid: '1000000000000000'
                },
                response: {
                    success: true,
                    data: {
                        requestId: 'req_84532_abc123',
                        status: 'pending',
                        estimatedTime: 300
                    }
                }
            },
            'Get Request Status': {
                method: 'GET',
                url: '/api/randomness/request/req_84532_abc123',
                response: {
                    success: true,
                    data: {
                        requestId: 'req_84532_abc123',
                        status: 'fulfilled',
                        randomValue: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
                        proofHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                        fulfilledAt: '2024-01-15T10:30:00Z'
                    }
                }
            },
            'Get User Requests': {
                method: 'GET',
                url: '/api/randomness/user/0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6?page=1&limit=10',
                response: {
                    success: true,
                    data: {
                        requests: [
                            {
                                requestId: 'req_84532_abc123',
                                chainId: 84532,
                                status: 'fulfilled',
                                randomValue: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
                                requestedAt: '2024-01-15T10:25:00Z',
                                fulfilledAt: '2024-01-15T10:30:00Z'
                            }
                        ],
                        pagination: {
                            page: 1,
                            limit: 10,
                            total: 1,
                            pages: 1
                        }
                    }
                }
            }
        }
    });
});

// SDK Documentation
router.get('/sdk', (req, res) => {
    res.json({
        sdk: {
            name: 'ZKRandom SDK',
            version: '1.0.0',
            languages: ['JavaScript', 'TypeScript', 'Python', 'Go'],
            installation: {
                javascript: 'npm install zkrandom-sdk',
                python: 'pip install zkrandom-sdk',
                go: 'go get github.com/zkrandom/sdk'
            },
            quickStart: {
                javascript: `
const { ZKRandom } = require('zkrandom-sdk');

const client = new ZKRandom({
    apiUrl: 'http://localhost:3000/api',
    chainId: 84532
});

// Request randomness
const request = await client.requestRandomness({
    seed: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    requester: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
});

// Check status
const status = await client.getRequestStatus(request.requestId);
console.log(status.randomValue);
                `,
                python: `
from zkrandom_sdk import ZKRandom

client = ZKRandom(
    api_url="http://localhost:3000/api",
    chain_id=84532
)

# Request randomness
request = client.request_randomness(
    seed="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    requester="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
)

# Check status
status = client.get_request_status(request.request_id)
print(status.random_value)
                `
            }
        }
    });
});

module.exports = router; 