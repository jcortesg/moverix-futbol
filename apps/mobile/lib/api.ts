import axios from 'axios'
import { getAuth_safe } from './useAuth'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/ftb/v1'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

// Attach Firebase token to every request
api.interceptors.request.use(async (config) => {
  const user = getAuth_safe().currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — will be handled by auth state listener
    }
    return Promise.reject(error)
  },
)
