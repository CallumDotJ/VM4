const jokeSetup = document.getElementById("setup");
const jokePunchline = document.getElementById("punchline");
const typeSelect = document.getElementById("typeSelect");
const newTypeInput = document.getElementById("newType");
const statusEl = document.getElementById("status");

// load types + first joke
document.addEventListener("DOMContentLoaded", () => {
    loadTypes();
    typeSelect.addEventListener("focus", loadTypes);
    fetchJoke();

    // ACTS AS THE POLLING
    setInterval(fetchJoke, 1000);
});

async function fetchJoke() {
    try {
        const response = await fetch('/moderator-api/moderate');

        if (!response.ok) {
            console.error("Error fetching joke:", response.statusText);
            statusEl.textContent = "Error fetching joke";
            return;
        }

        const data = await response.json();
        console.log(data);

        if (!data.available) {
            statusEl.textContent = "No jokes available yet.";
            clearForm();
            return;
        }

        const joke = data.joke;

        jokeSetup.value = joke.setup || "";
        jokePunchline.value = joke.punchline || "";

        // populate type
        const exists = [...typeSelect.options].some(opt => opt.value === joke.type);

        if (exists) {
            typeSelect.value = joke.type;
            newTypeInput.value = "";
        } else {
            typeSelect.value = "";
            newTypeInput.value = joke.type || "";
        }

        statusEl.textContent = "Joke loaded";

    } catch (error) {
        console.error("Error fetching joke:", error);
        statusEl.textContent = "Error fetching joke";
    }
}



document.getElementById("moderateForm").addEventListener("submit", async (e) => {

    // stops the funky ani
    e.preventDefault();

    const setup = jokeSetup.value.trim();
    const punchline = jokePunchline.value.trim();
    const selectedType = typeSelect.value.trim();
    const newType = newTypeInput.value.trim();

    const type = newType || selectedType;

    if (!setup || !punchline || !type) {
        statusEl.textContent = "Please fill in setup, punchline and type.";
        return;
    }

    try {
        const response = await fetch('/moderator-api/moderated', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ setup, punchline, type })
        });

        const data = await response.json();

        if (!response.ok) {
            statusEl.textContent = data.error || "Failed to submit joke";
            return;
        }

        statusEl.textContent = "Joke approved and submitted";

        clearForm();
        fetchJoke(); // load next joke

    } catch (error) {
        console.error("Submit error:", error);
        statusEl.textContent = "Error submitting joke";
    }
});


document.getElementById("rejectBtn").addEventListener("click", () => {
    statusEl.textContent = "Joke rejected. Loading next...";
    clearForm();
    fetchJoke();
});


async function loadTypes() {
    try {
        const response = await fetch('/moderator-api/types');

        if (!response.ok) {
            console.error("Error fetching types");
            return;
        }

        const data = await response.json();

        typeSelect.innerHTML = '<option value="">-- Select Type --</option>';

        if (Array.isArray(data.types)) {
            data.types.forEach(type => {
                const option = document.createElement("option");
                option.value = type;
                option.textContent = type;
                typeSelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error("Error loading types:", error);
    }
}

function clearForm() {
    jokeSetup.value = "";
    jokePunchline.value = "";
    typeSelect.value = "";
    newTypeInput.value = "";
}