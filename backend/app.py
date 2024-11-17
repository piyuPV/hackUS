from flask import Flask, request, jsonify
from openai import OpenAI

app = Flask(__name__)

# Initialize the OpenAI client
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key="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"
)

# Define the operation function
def op(query):
    try:
        completion = client.chat.completions.create(
            model="nvidia/llama-3.1-nemotron-70b-instruct",
            messages=[{"role": "user", "content": query}],
            temperature=0.5,
            top_p=1,
            max_tokens=1024,
            stream=True
        )
        response_text = ""
        for chunk in completion:
            if chunk.choices[0].delta.content is not None:
                response_text += chunk.choices[0].delta.content
        return response_text or "No response received from the AI model."
    except Exception as e:
        print("Error during AI processing:", e)
        return "An error occurred while processing your query."

# Define the API endpoint
@app.route('/query', methods=['POST'])
def query():
    data = request.json
    query = data.get("query")
    if not query:
        return jsonify({"error": "Query not provided"}), 400
    result = op(query)
    return jsonify({"Query": query, "response": result})

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
