import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Unregister any existing service worker to prevent caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service worker unregistered:', registration);
    }
  }).catch(error => {
    console.error('Error unregistering service workers:', error);
  });
  
  // Also clear all caches
  if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
      return Promise.all(cacheNames.map(function(cacheName) {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      }));
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
