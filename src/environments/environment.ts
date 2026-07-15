// environment.ts (development)
export const environment = {
  production: false,
  apiUrl: 'https://backend-store-clg5.onrender.com/api',
  // apiUrl: 'http://localhost:8083/api',
  // apiUrl: 'http://192.168.1.41:8083/api',

  wsUrl: 'https://backend-store-clg5.onrender.com/ws'
};

// environment.prod.ts
export const environmentProd = {
  production: true,
  apiUrl: 'https://backend-store-clg5.onrender.com/api',
  wsUrl: 'https://backend-store-clg5.onrender.com/ws'
};
