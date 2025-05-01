<script>
    function downloadDoc() {
        const form = document.getElementById("docForm");
        const formData = new FormData(form);

        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            params.append(key, value);
        }

        fetch("/api/download?" + params.toString(), {
            method: "GET"
        })
        .then(response => {
            if (!response.ok) throw new Error("Download failed");

            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "document.docx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        })
        .catch(err => {
            alert("Error: " + err.message);
        });
    }
</script>
