
import { Configuration, PublicClientApplication } from "@azure/msal-browser";

const getRedirectUri = () => {
  return window.location.origin.split('?')[0].replace(/\/$/, "");
};

const TENANT_DOMAIN = 'vialacteoscombr.sharepoint.com';

export const msalConfig: Configuration = {
  auth: {
    clientId: "c176306d-f849-4cf4-bfca-22ff214cdaad",
    authority: "https://login.microsoftonline.com/7d9754b3-dcdb-4efe-8bb7-c0e5587b86ed",
    redirectUri: getRedirectUri(),
    postLogoutRedirectUri: getRedirectUri(),
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
  }
};

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  console.log("MSAL Pronto. URL de Redirecionamento:", getRedirectUri());
}).catch(err => console.error("Falha no MSAL Init:", err));

/**
 * LOGIN_REQUEST: Apenas escopos do Microsoft Graph.
 * Escopos de recursos diferentes (SharePoint) devem ser solicitados separadamente via acquireTokenSilent.
 */
export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "User.Read",
    "Sites.Read.All"
  ]
};
