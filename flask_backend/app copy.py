import os
from datetime import timedelta
from flask import Flask, render_template, request, session, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

# Cargar variables de entorno desde .env, si existe
load_dotenv()

# Crear instancia de Flask y habilitar CORS para permitir peticiones desde el frontend
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, origins=["http://localhost:5173"])  # Ajusta la lista según tus orígenes permitidos

# Configuración de la clave secreta y duración de la sesión
app.secret_key = os.getenv("FLASK_SECRET_KEY", "cambia-esta-clave-super-secreta")
app.permanent_session_lifetime = timedelta(hours=6)

# Configurar el cliente de OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("MODEL", "gpt-4o-mini")
client = OpenAI(api_key=OPENAI_API_KEY)

# Prompt del sistema para el chat
SYSTEM_PROMPT = (
    "Eres un asistente útil y claro. Responde en español con precisión y brevedad."
)

# Funciones auxiliares para manejar el historial de chat
def get_history():
    if "history" not in session:
        session["history"] = [{"role": "system", "content": SYSTEM_PROMPT}]
    return session["history"]


def add_message(role: str, content: str) -> None:
    history = get_history()
    history.append({"role": role, "content": content})
    session["history"] = history


@app.route("/", methods=["GET"])
def index() -> str:
    """Renderiza la página de inicio del chatbot."""
    if request.args.get("new") == "1":
        session.pop("history", None)
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat() -> tuple:
    """Maneja una conversación general con el modelo OpenAI."""
    data = request.get_json(silent=True) or {}
    user_msg = data.get("message", "").strip()
    if not user_msg:
        return jsonify({"ok": False, "error": "Mensaje vacío"}), 400
    # Añadir mensaje del usuario al historial
    add_message("user", user_msg)
    try:
        resp = client.chat.completions.create(
            model=MODEL, messages=get_history(), temperature=0.7, max_tokens=400
        )
        reply = resp.choices[0].message.content
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    # Añadir respuesta del asistente al historial
    add_message("assistant", reply)
    return jsonify({"ok": True, "reply": reply})


@app.route("/api/ai-recommendation", methods=["POST"])
def ai_recommendation() -> tuple:
    """Genera recomendaciones agrícolas basadas en datos de cultivo y clima."""
    data = request.get_json(silent=True) or {}
    # Extraer parámetros; usa .get para evitar KeyError en caso de ausencia
    crop_name = data.get("crop_name")
    feasibility_level = data.get("feasibility_level")
    score = data.get("feasibility_score")
    temp = data.get("temperature")
    soil = data.get("soil_moisture")
    precip = data.get("precipitation")
    location = data.get("location_name")
    # Construir prompt del usuario para la IA
    user_prompt = (
        f"Para el cultivo {crop_name} en {location}: Viabilidad {feasibility_level} "
        f"(puntuación {score}). Condiciones: {temp}°C, humedad del suelo {soil}%, "
        f"precipitación {precip} mm. ¿Qué recomendaciones puedes dar al agricultor?"
    )
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
            temperature=0.7,
            max_tokens=200,
        )
        message = response.choices[0].message.content.strip()
        return jsonify({"message": message})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Ejecutar en modo desarrollo en el puerto 8000 para desarrollo local
    app.run(host="0.0.0.0", port=8000, debug=True)