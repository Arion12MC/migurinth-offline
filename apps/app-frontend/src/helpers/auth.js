/**
 * All theseus API calls return serialized values (both return values and errors);
 * So, for example, addDefaultInstance creates a blank Profile object, where the Rust struct is serialized,
 *  and deserialized into a usable JS object.
 */
import { invoke } from '@tauri-apps/api/core'

// Example function:
// User goes to auth_url to complete flow, and when completed, authenticate_await_completion() returns the credentials
// export async function authenticate() {
//   const auth_url = await authenticate_begin_flow()
//   console.log(auth_url)
//   await authenticate_await_completion()
// }

/**
 * Authenticate a user with Hydra - part 1.
 * This begins the authentication flow quasi-synchronously.
 *
 * @returns {Promise<DeviceLoginSuccess>} A DeviceLoginSuccess object with two relevant fields:
 * @property {string} verification_uri - The URL to go to complete the flow.
 * @property {string} user_code - The code to enter on the verification_uri page.
 */
export async function login() {
  return await invoke('plugin:auth|login')
}

/**
 * Retrieves the default user
 * @return {Promise<UUID | undefined>}
 */
export async function get_default_user() {
  return await invoke('plugin:auth|get_default_user')
}

/**
 * Updates the default user
 * @param {UUID} user
 */
export async function set_default_user(user) {
  return await invoke('plugin:auth|set_default_user', { user })
}

/**
 * Remove a user account from the database
 * @param {UUID} user
 */
export async function remove_user(user) {
  return await invoke('plugin:auth|remove_user', { user })
}

/**
 * Returns a list of users
 * @returns {Promise<Credential[]>}
 */
export async function users() {
  return await invoke('plugin:auth|get_users')
}
// --- OFFLINE ACCOUNTS SUPPORT ---

const OFFLINE_ACCOUNTS_KEY = 'offline_accounts'
const OFFLINE_USER_PREFIX = 'offline-'

function getOfflineAccounts() {
  const raw = localStorage.getItem(OFFLINE_ACCOUNTS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveOfflineAccounts(accounts) {
  localStorage.setItem(OFFLINE_ACCOUNTS_KEY, JSON.stringify(accounts))
}

export async function offline_login(username) {
  if (!username || username.length === 0)
    throw new Error('Username required for offline account.')
  const accounts = getOfflineAccounts()
  if (accounts.some(acc => acc.username === username))
    throw new Error('Offline account with this username already exists.')
  const account = {
    id: OFFLINE_USER_PREFIX + username,
    username,
    type: 'offline',
  }
  accounts.push(account)
  saveOfflineAccounts(accounts)
  // Optionally set as default user
  localStorage.setItem('default_user', account.id)
  return account
}

export async function users() {
  // Get online accounts from backend
  let backendUsers = []
  try {
    backendUsers = await invoke('plugin:auth|get_users')
  } catch {}
  // Load offline accounts from localStorage
  const offlineUsers = getOfflineAccounts()
  // Merge and return
  return [...backendUsers, ...offlineUsers]
}

export async function set_default_user(userId) {
  if (userId.startsWith(OFFLINE_USER_PREFIX)) {
    localStorage.setItem('default_user', userId)
    return userId
  }
  return await invoke('plugin:auth|set_default_user', { user: userId })
}

export async function get_default_user() {
  const offlineDefault = localStorage.getItem('default_user')
  if (offlineDefault && offlineDefault.startsWith(OFFLINE_USER_PREFIX)) {
    return offlineDefault
  }
  return await invoke('plugin:auth|get_default_user')
}

export async function remove_user(userId) {
  if (userId.startsWith(OFFLINE_USER_PREFIX)) {
    let accounts = getOfflineAccounts()
    accounts = accounts.filter(acc => acc.id !== userId)
    saveOfflineAccounts(accounts)
    if (localStorage.getItem('default_user') === userId) {
      localStorage.removeItem('default_user')
    }
    return
  }
  return await invoke('plugin:auth|remove_user', { user: userId })
}
export function isLocalAccount(session) {
  // session.type could be "microsoft" or "local"
  return session?.type === 'local';
}
