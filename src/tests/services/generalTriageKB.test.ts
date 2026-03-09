import { GeneralTriageKBService } from '../../services/generalTriageKB';
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { mockClient } from 'aws-sdk-client-mock';

const bedrockMock = mockClient(BedrockAgentRuntimeClient);

describe('GeneralTriageKBService', () => {
    let service: GeneralTriageKBService;

    beforeEach(() => {
        bedrockMock.reset();
        process.env.BEDROCK_KB_ID = 'test-kb-id';
        process.env.BEDROCK_REGION = 'us-east-1';
        service = new GeneralTriageKBService();
    });

    test('retrieveChunks returns chunks on success', async () => {
        bedrockMock.on(RetrieveCommand).resolves({
            retrievalResults: [
                {
                    content: { text: 'Protocol for fever' },
                    location: {
                        type: 'S3',
                        s3Location: { uri: 's3://bucket/fever.pdf' }
                    },
                    score: 0.95,
                },
            ],
        });

        const results = await service.retrieveChunks('fever');

        expect(results.chunks).toEqual(['Protocol for fever']);
        expect(results.sources).toEqual(['s3://bucket/fever.pdf']);
        expect(results.relevanceScores).toEqual([0.95]);
    });

    test('retrieveChunks returns empty results when KB_ID is missing', async () => {
        const oldId = process.env.BEDROCK_KB_ID;
        delete process.env.BEDROCK_KB_ID;

        // We need to re-instantiate because kbId is set in constructor
        const serviceNoId = new GeneralTriageKBService();

        const results = await serviceNoId.retrieveChunks('fever');

        expect(results.chunks).toEqual([]);
        expect(bedrockMock.calls()).toHaveLength(0);

        process.env.BEDROCK_KB_ID = oldId;
    });

    test('retrieveChunks returns empty results on error', async () => {
        bedrockMock.on(RetrieveCommand).rejects(new Error('Bedrock unavailable'));

        const results = await service.retrieveChunks('fever');

        expect(results.chunks).toEqual([]);
    });

    test('queryTriage uses retrieveChunks and returns TriageResponse', async () => {
        bedrockMock.on(RetrieveCommand).resolves({
            retrievalResults: [
                {
                    content: { text: 'Protocol for snakebite' },
                    location: {
                        type: 'S3',
                        s3Location: { uri: 's3://bucket/snake.pdf' }
                    },
                    score: 0.8,
                },
            ],
        });

        const response = await service.queryTriage(['snakebite'], 'adult', {} as any);

        expect(response.chunks).toEqual(['Protocol for snakebite']);
        expect(response.generatedResponse).toBe("");
        expect(response.severity).toBe("non-urgent");
    });
});
