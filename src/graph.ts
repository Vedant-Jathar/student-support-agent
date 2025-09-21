import { StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./state";
import { model } from "./model";

async function frontDeskSupport(state: typeof StateAnnotation.State) {
    const SYSTEM_PROMPT = `You are a frontline support staff for Coders Gyan,an ed-tech company that helps software developers excel in their careers by making web development and Gen AI courses.
    Be concise in your responses.
    You can chat with the student and help with basic questions but if the student has a marketing or learning support query then don't answer directly.
    Immediately transfer the question to the marketing support team(promo codes, discounts, offers and special campaigns) or learning support team(courses, syllabus coverage, learning paths and study strategies.) and ask the student to hold for a moment.
    `

    const supportResponse = await model.invoke([{ role: "system", content: SYSTEM_PROMPT }, ...state.messages])

    console.log("Support res:", supportResponse);

    const CATEGORIZATION_SYSTEM_PROMPT = `You are an expert customer support routing system.
    Your job is to detect whether a customer support representative is routing a user to a marketing team or learning team or just responding conversationally.
    `

    const CATEGORIZATION_HUMAN_PROMPT = `The previous conversation is an interaction between a customer support representative and a user.
    Extract whether the representative is routing the user to a marketing team or learning team or just responding coversationally.
    Respond with a JSON object with a single key "nextRepresentative".
    Eg:{nextRepresentative:"MARKETING"}
    If they want to route the user to the marketing team then respond with "MARKETING"
    If they want to route the user to the learning team then respond with "LEARNING"
    If they want to respond conversationally then respond with "RESPOND"
    `
    const CATEGORIZATION_RESPONSE = await model.invoke([
        { role: "system", content: CATEGORIZATION_SYSTEM_PROMPT },
        ...state.messages,
        supportResponse,
        { role: "user", content: CATEGORIZATION_HUMAN_PROMPT }
    ], { response_format: { type: "json_object" } })

    console.log("CATEGORIZATION_RESPONSE: ",CATEGORIZATION_RESPONSE);
    
    const CATEGORIZATION_OUTPUT = JSON.parse(CATEGORIZATION_RESPONSE.content as string)

    return {
        messages: [supportResponse],
        nextRepresentative: CATEGORIZATION_OUTPUT.nextRepresentative
    }
}

function marketingSupport(state: typeof StateAnnotation) {
    console.log("This is the answer provided by the marketing support");

    return state
}

function learningSupport(state: typeof StateAnnotation) {
    console.log("This is the answer provided by the learning support");

    return state
}

function whatNextAfterFDS(state: typeof StateAnnotation.State) {
    if (state.nextRepresentative.includes("MARKETING")) {
        return "marketingSupport"
    }
    else if (state.nextRepresentative.includes("LEARNING")) {
        return "learningSupport"
    }
    else if (state.nextRepresentative.includes("RESPOND")) {
        return "__end__"
    }
    else {
        return "__end__"
    }
}

const graph = new StateGraph(StateAnnotation)
    .addNode("frontDeskSupport", frontDeskSupport)
    .addNode("marketingSupport", marketingSupport)
    .addNode("learningSupport", learningSupport)
    .addEdge("__start__", "frontDeskSupport")
    .addEdge("marketingSupport", "__end__")
    .addEdge("learningSupport", "__end__")
    .addConditionalEdges("frontDeskSupport", whatNextAfterFDS)

const app = graph.compile()

async function main() {

    const stream = await app.stream({
        messages: [
            {
                role: "user",
                content: "Is there any GEN AI course?"
            }
        ]
    })

    for await (let i of stream) {
        console.log("**********************STEP**********************");
        console.log(i);
        console.log("**********************STEP**********************");
    }
}

main()