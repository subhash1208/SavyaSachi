import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { IGeneralTriageKB } from "../interfaces/IGeneralTriageKB";
import { TriageResponse, ConversationContext, KBResults } from "../models/types";
import { SeverityLevel } from "../models/enums";

/**
 * GeneralTriageKBService — Interface to Amazon Bedrock Knowledge Base (RAG).
 * 
 * Queries WHO/IMCI/IMAI medical protocols stored as vector embeddings in OpenSearch Serverless.
 * Retrieves top-K relevant chunks to provide clinical context to the TriageAgent (Nova Pro).
 */
export class GeneralTriageKBService implements IGeneralTriageKB {
    private client: BedrockAgentRuntimeClient;
    private kbId: string;

    constructor(region: string = process.env.BEDROCK_REGION || "us-east-1") {
        this.client = new BedrockAgentRuntimeClient({ region });
        this.kbId = process.env.BEDROCK_KB_ID || "";
    }

    /**
     * Retrieves top-5 relevant medical protocol chunks from the Knowledge Base.
     * Chaks are returned with metadata (S3 source URI and relevance score).
     */
    async retrieveChunks(query: string): Promise<KBResults> {
        if (!this.kbId) {
            console.warn("BEDROCK_KB_ID not set — skipping KB retrieval");
            return { chunks: [], sources: [], relevanceScores: [] };
        }

        try {
            const command = new RetrieveCommand({
                knowledgeBaseId: this.kbId,
                retrievalQuery: {
                    text: query,
                },
                retrievalConfiguration: {
                    vectorSearchConfiguration: {
                        numberOfResults: 5,
                    },
                },
            });

            const response = await this.client.send(command);

            return {
                chunks: response.retrievalResults?.map(r => r.content?.text || "") || [],
                sources: response.retrievalResults?.map(r => r.location?.s3Location?.uri || "unknown") || [],
                relevanceScores: response.retrievalResults?.map(r => r.score || 0) || [],
            };
        } catch (error) {
            console.error("Knowledge Base retrieval failed:", error);
            return { chunks: [], sources: [], relevanceScores: [] };
        }
    }

    // ─── IGeneralTriageKB Implementation ───────────────────────────────────────

    /**
     * Legacy interface for querying triage data.
     * internally uses retrieveChunks for RAG logic.
     */
    async queryTriage(symptoms: string[], patientCategory: string, context: ConversationContext): Promise<TriageResponse> {
        const query = symptoms.join(", ");
        const results = await this.retrieveChunks(query);

        return {
            chunks: results.chunks,
            generatedResponse: "", // Bedrock KB 'Retrieve' only returns chunks; Nova Pro (TriageAgent) generates the response.
            severity: "non-urgent", // Default severity — refined by TriageAgent.
        };
    }

    /**
     * Placeholder for follow-up question generation using KB context.
     * In the current architecture, Nova Pro (TriageAgent) handles all generation.
     */
    async generateFollowUpQuestion(context: ConversationContext): Promise<string> {
        return "";
    }

    /**
     * Placeholder for severity classification.
     * In the current architecture, Nova Pro (TriageAgent) handles all classification.
     */
    classifySeverity(triageResult: any): SeverityLevel {
        return "non-urgent";
    }
}
