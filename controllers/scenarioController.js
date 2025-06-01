import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/config.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Validation function for scenarios
const validateScenario = (scenario, format) => {
    const errors = [];

    if (!scenario.presentation || scenario.presentation.length < 20) { // Added length check
        errors.push('Missing or too short patient presentation');
    }

    if (!scenario.question || scenario.question.length < 10) { // Added length check
        errors.push('Missing or too short question section');
    }

    if (!scenario.answer || scenario.answer.length < 20) { // Added length check
        errors.push('Missing or too short answer section');
    }

    if (format === 'sba' && scenario.options.length !== 5) { // Strict check for 5 options
        errors.push(`SBA format requires exactly 5 options (found ${scenario.options.length})`);
    }

    if (format === 'osce' && scenario.markingCriteria.length < 5) { // At least 5 criteria
        errors.push('OSCE format requires at least 5 marking criteria');
    }

    return errors.length === 0 ? null : errors.join(', ');
};

const generateScenarios = async (req, res) => {
    try {
        const { topic, count, difficulty, format, language } = req.body;

        // Validate input
        if (!topic || !count || !difficulty) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.7,
                topP: 1,
                topK: 1,
                maxOutputTokens: 2048,
            },
        });

        const difficultyMap = {
            'basic': 'first or second year medical student',
            'intermediate': 'third year medical student on clinical rotations',
            'advanced': 'fourth year medical student or resident'
        };

        const formatMap = {
            'long': {
                description: 'detailed narrative format',
                requirements: 'Provide comprehensive explanations and reasoning. Ensure answers are prose.'
            },
            'short': {
                description: 'concise bullet points',
                requirements: 'Keep responses brief but clinically accurate, using bullet points in answers.'
            },
            'sba': {
                description: 'single best answer question format',
                requirements: 'Include exactly 5 options (A-E) with one clearly correct answer. Options must be within the "Question:" section. The "Answer:" section must clearly state the correct option and provide detailed reasoning.'
            },
            'osce': {
                description: 'OSCE station style',
                requirements: 'Include a "Marking Criteria:" section within the "Answer:" with at least 5 key points to cover, using bullet points.'
            }
        };

        const prompt = `
        You are a medical education expert creating clinical scenario questions for ${difficultyMap[difficulty]}.
        Language: ${language || 'English'}
        Format: ${formatMap[format].description}

        For the topic: ${topic}

        Generate ${count} high-quality clinical scenario questions. Each scenario must strictly follow this structure:

        Scenario #: [Patient Presentation goes here. This should be a detailed narrative including history, physical exam findings, and diagnostic test results.]

        Question: [Clear clinical question asking what to do next or for diagnosis/management. For SBA, include A) B) C) D) E) options here.]

        Answer: [Detailed explanation, including:
          * The most likely diagnosis
          * Diagnostic approach
          * Immediate management steps
          * Key teaching points
          * Relevant differential diagnoses
          ${format === 'osce' ? 'Marking Criteria: [At least 5 bullet points for grading.]' : ''}
        ]

        Additional requirements for ${formatMap[format].description} format:
        ${formatMap[format].requirements}

        General requirements for all formats:
        - Ensure a realistic patient case appropriate for ${difficultyMap[difficulty]}.
        - Challenge the student's diagnostic reasoning.
        - Cover important learning points about the topic.
        - Include references to latest guidelines where applicable.
        - Highlight red flag symptoms when relevant.
        - Provide estimated prevalence if discussing rare conditions.
        - **IMPORTANT: Each scenario MUST start with "Scenario #:" (e.g., "Scenario 1:").**
        - **IMPORTANT: Ensure each section is substantial and not empty.**
        - **IMPORTANT: The "Question:" and "Answer:" headings MUST be present and exact.**
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("RAW AI RESPONSE TEXT:\n", text); // Log raw output for debugging

        // Parse and validate scenarios
        const scenarios = parseScenarios(text, format);

        // Validate each scenario
        const validationResults = scenarios.map(scenario => ({
            scenario,
            errors: validateScenario(scenario, format)
        }));

        // Filter out scenarios with errors and provide feedback
        const validScenarios = validationResults.filter(r => r.errors === null).map(r => r.scenario);
        const invalidScenarios = validationResults.filter(r => r.errors);

        if (invalidScenarios.length > 0) {
            console.warn('Warnings: Some scenarios failed validation and were excluded:', invalidScenarios);
        }

        if (validScenarios.length === 0 && count > 0) {
             return res.status(500).json({
                error: 'No valid scenarios could be generated or parsed from the AI response.',
                details: invalidScenarios.length > 0 ? `All generated scenarios failed validation: ${JSON.stringify(invalidScenarios)}` : 'AI generated no content or unparsable content.'
            });
        }


        res.json({
            success: true,
            scenarios: validScenarios, // Only return valid scenarios
            metadata: {
                topic,
                requested_count: count,
                generated_count: validScenarios.length, // Actual count after validation
                difficulty,
                format,
                language,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Failed to generate scenarios',
            details: error.message
        });
    }
};

// Helper function for example structure (not directly used in parsing, just for prompt)
function getFormatExample(format) {
    const examples = {
        long: `
Scenario 1: Patient presentation...

Question: What is the most likely diagnosis?

Answer: The most likely diagnosis is...`,

        sba: `
Scenario 1: Patient presentation...

Question: What is the next best step?
A) Option 1
B) Option 2
C) Option 3
D) Option 4
E) Option 5

Answer: The correct answer is C) Option 3 because...`,

        osce: `
Scenario 1: Patient presentation...

Question: Perform a focused cardiovascular exam.

Answer: Key findings would include...
Marking Criteria:
- Correctly identifies heart sounds
- Checks for peripheral edema
- Assesses jugular venous pressure
- Documents findings clearly
- Provides appropriate differential`
    };
    return examples[format] || examples.long;
}

// Updated parsing function for robustness
function parseScenarios(text, format) {
    let cleanedText = text.trim();

    // Ensure the very first scenario block starts with "Scenario #:", if not, try to fix it.
    // This is the most crucial part for "Scenario 0" / first scenario's presentation.
    if (!cleanedText.startsWith('Scenario')) {
        const firstQuestionIndex = cleanedText.indexOf('Question:');
        if (firstQuestionIndex !== -1) {
            // Assume everything before the first "Question:" is the presentation, if no "Scenario #"
            cleanedText = `Scenario 1:\n${cleanedText}`;
        } else {
            console.warn("AI response does not contain 'Scenario #' or 'Question:'. Cannot reliably parse.");
            return []; // Return empty array if structure is too far off
        }
    }


    // Split by "Scenario #:" or "Scenario #", ensuring the ID is captured
    // This regex now consumes the "Scenario #:" part with the ID, then splits.
    const rawBlocks = cleanedText.split(/Scenario (\d+):?/i);
    const scenarioBlocks = [];

    // The split method puts the captured groups (the numbers) into the array.
    // So, rawBlocks will look like: [ '', '1', 'Presentation...', '2', 'Presentation...', ... ]
    for (let i = 1; i < rawBlocks.length; i += 2) {
        const id = rawBlocks[i];
        const content = rawBlocks[i + 1];
        if (id && content) {
            scenarioBlocks.push(`Scenario ${id}:\n${content}`); // Reconstruct the block for consistent parsing later
        }
    }

    return scenarioBlocks.map(block => {
        const scenario = {
            id: '0',
            presentation: '',
            question: '',
            answer: '',
            options: [],
            markingCriteria: []
        };

        try {
            // Extract ID
            const idMatch = block.match(/Scenario (\d+):?/i);
            if (idMatch) {
                scenario.id = idMatch[1];
            }

            // Extract presentation: from "Scenario #: " to "Question:" or "Answer:" or end
            // Make it non-greedy and case-insensitive. Now it looks for "Question:" OR "Answer:"
            // to mark the end of the presentation, to be more robust.
            const presentationMatch = block.match(/Scenario \d+:?([\s\S]*?)(?=(?:Question:|Answer:|$))/i);
            if (presentationMatch && presentationMatch[1].trim().length > 0) {
                scenario.presentation = presentationMatch[1].trim();
            } else {
                 console.warn(`Scenario ${scenario.id}: Presentation not found or empty after stripping 'Scenario #:'.`);
            }

            // Extract question: from "Question:" to "Answer:" or end
            const questionMatch = block.match(/Question:([\s\S]*?)(?=Answer:|$)/i);
            if (questionMatch && questionMatch[1].trim().length > 0) {
                scenario.question = questionMatch[1].trim();
            } else {
                 console.warn(`Scenario ${scenario.id}: Question not found or empty.`);
            }

            // Extract answer: from "Answer:" to end of block
            const answerMatch = block.match(/Answer:([\s\S]*)/i);
            if (answerMatch && answerMatch[1].trim().length > 0) {
                scenario.answer = answerMatch[1].trim();
            } else {
                 console.warn(`Scenario ${scenario.id}: Answer not found or empty.`);
            }

            // Special parsing for SBA format (options within question)
            if (format === 'sba') {
                const optionsRegex = /^([A-E])[).]\s*(.+)$/gm; // Matches A) Option, B. Option etc.
                const rawQuestionLines = scenario.question.split('\n');
                let stemLines = [];
                let optionLines = [];

                // Iterate lines to separate stem from options
                for (const line of rawQuestionLines) {
                    if (optionsRegex.test(line.trim())) { // Test on trimmed line
                        optionLines.push(line.trim());
                    } else {
                        stemLines.push(line.trim());
                    }
                }
                scenario.question = stemLines.join('\n').trim(); // Keep only the stem
                scenario.options = optionLines.map(opt => opt.replace(/^[A-E][).]\s*/, '').trim()); // Extract option text
            }


            // Special parsing for OSCE format (marking criteria within answer)
            if (format === 'osce') {
                const criteriaMatch = scenario.answer.match(/(Marking Criteria|Key Points):?([\s\S]*)/i);
                if (criteriaMatch && criteriaMatch[2].trim().length > 0) {
                    scenario.markingCriteria = criteriaMatch[2]
                        .split('\n')
                        .map(line => line.replace(/^[\-\*]\s*/, '').trim()) // Remove leading bullets/hyphens
                        .filter(line => line.length > 0); // Ensure no empty lines
                    // Remove criteria from main answer text
                    scenario.answer = scenario.answer.replace(criteriaMatch[0], '').trim();
                }
            }

        } catch (e) {
            console.error(`Error during detailed parsing for scenario ${scenario.id}:`, e);
            // Set fields to empty if parsing fails for this scenario to allow validation to catch it
            scenario.presentation = '';
            scenario.question = '';
            scenario.answer = '';
        }

        return scenario;
    });
}

export { generateScenarios };