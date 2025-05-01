<script>
document.getElementById('downloadForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;

    const params = new URLSearchParams({ name, email, phone });

    const response = await fetch('/api/download?' + params.toString(), {
        method: 'GET'
    });

    if (!response.ok) {
        alert('Error generating document');
        return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "document.docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
});
</script>
