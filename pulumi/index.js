// escUtils.js
import * as esc from "@pulumi/esc-sdk";
import dotenv from "dotenv";
dotenv.config();

const org = process.env.PULUMI_ORG;
const project = process.env.PULUMI_PROJECT;
const env = process.env.PULUMI_ENV;

if (!org || !project || !env) {
    throw new Error("Missing PULUMI_ORG, PULUMI_PROJECT, or PULUMI_ENV in environment");
}

const client = esc.DefaultClient();

/**
 * Get deeply nested value by path
 */
function getValueByPath(obj, path) {
    const keys = path.split(".");
    return keys.reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

/**
 * Set deeply nested value by path
 */
function setValueByPath(obj, path, value) {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k]) current[k] = {};
        current = current[k];
    }

    current[keys[keys.length - 1]] = value;
}

/**
 * Recursively flatten an object with dot notation keys
 */
function flatten(obj, prefix = "") {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? `${prefix}.` : "";
        if (typeof obj[k] === "object" && obj[k] !== null) {
            Object.assign(acc, flatten(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }
        return acc;
    }, {});
}

/**
 * Get a value from ESC by key path
 */
export async function getEscValue(keyPath) {
    const envData = await client.openAndReadEnvironment(org, project, env);
    if (!envData || !envData.values) {
        throw new Error("❌ Failed to read ESC environment");
    }
    return getValueByPath(envData.values, keyPath);
}

/**
 * Update or insert a value in ESC by key path
 */
export async function updateEscValue(keyPath, value) {
    const envData = await client.openAndReadEnvironment(org, project, env);
    if (!envData || !envData.values) {
        throw new Error("❌ Failed to load environment for update");
    }

    const updatedValues = JSON.parse(JSON.stringify(envData.values));
    setValueByPath(updatedValues, keyPath, value);
    await client.updateEnvironment(org, project, env, { values: updatedValues });
    console.log(`✅ Updated "${keyPath}" to "${value}"`);
}

/**
 * Read the entire environment and return as a flat JSON object
 */
export async function readAllEnvValues(flattenOutput = true) {
    const envData = await client.openAndReadEnvironment(org, project, env);
    if (!envData || !envData.values) {
        throw new Error("❌ Failed to read ESC environment");
    }

    // Exclude `environmentVariables` key
    const { environmentVariables, ...filteredValues } = envData.values;

    return flattenOutput ? flatten(filteredValues) : filteredValues;
}
