import dotenv from "dotenv";

// Load local configuration without overwriting explicit test/CI environment values.
// Quiet mode avoids disclosing environment paths or configuration in startup output.
dotenv.config({ quiet: true });
