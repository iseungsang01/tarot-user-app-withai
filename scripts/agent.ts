import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set in environment variables or .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    let inputData = '';

    // Read from standard input (pipeline)
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
        inputData += chunk;
    }

    if (!inputData.trim()) {
        console.error("Error: No input provided. Usage: Get-Content PROMPT.md | node scripts/agent.js");
        process.exit(1);
    }

    try {
        // Use gemini-2.5-flash as the default model
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        console.log("Agent is thinking...");
        const result = await model.generateContent(inputData);
        const response = await result.response;
        const text = response.text();
        
        console.log("\n================ AGENT RESPONSE ================\n");
        console.log(text);
        console.log("\n================================================\n");

        // Optional: Append response to a log file
        fs.appendFileSync('agent-log.txt', `\n[${new Date().toISOString()}] Input:\n${inputData}\nOutput:\n${text}\n----------------\n`);
        
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        process.exit(1);
    }
}

run();
