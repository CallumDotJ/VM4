const jokeSetup = document.getElementById("setup");
const jokePunchline = document.getElementById("punchline");

// load types on page load
document.addEventListener("DOMContentLoaded", () => {

    const select = document.getElementById("typeSelect");

    loadTypes();
    select.addEventListener("focus", loadTypes); // refresh on interaction

    fetchJoke(); // also fetch first joke on load
});


/* Joke Fetcher */

async function fetchJoke()
{
    try
    {
        const response = await fetch('/moderator-api/moderate');

        if(!response.ok)
        {
            console.error("Error fetching joke:", response.statusText);
            return;
        }

        const data = await response.json();

        console.log(data);

        // 🔑 FIX: match expected backend shape
        if(!data.available)
        {
            document.getElementById("status").textContent = "No jokes available yet. ";
            jokeSetup.value = "";
            jokePunchline.value = "";
            return;
        }

        const joke = data.joke;

        // display joke
        jokeSetup.value = joke.setup;
        jokePunchline.value = joke.punchline;

        document.getElementById("status").textContent = "Joke loaded";

    }
    catch(error)
    {
        console.error("Error fetching joke:", error);
    }
}


// Reject button → just fetch next joke
document.getElementById("rejectBtn").addEventListener("click", fetchJoke);