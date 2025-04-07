// onepassword.js
import sdk from "@1password/sdk";
import dotenv from "dotenv";
dotenv.config();

let client;

// Ensure singleton client
async function getClient() {
    if (!client) {
        client = await sdk.createClient({
            auth: process.env.OP_SERVICE_ACCOUNT_TOKEN,
            integrationName: "AntiLeaked",
            integrationVersion: "v1.0.0",
        });
    }
    return client;
}

/**
 * Resolve a secret from 1Password using its secret reference.
 * @param {string} secretRef - e.g. "op://Vault/Item/field"
 * @returns {Promise<string>} - The resolved secret value
 */
export async function resolveSecret(secretRef) {
    const c = await getClient();
    const secret = await c.secrets.resolve(secretRef);
    return secret;
}
