// Load gathering data into form
function loadGatheringData(data) {
    const timeInput = document.getElementById(`${data.profession}-time`);
    if (timeInput) {
        timeInput.value = data.time;
    }
    
    const professionDiv = document.getElementById(data.profession);
    if (professionDiv) {
        data.materials.forEach(mat => {
            const materialItems = professionDiv.querySelectorAll('.material-item');
            materialItems.forEach(item => {
                const labelText = item.querySelector('label').textContent;
                const label = labelText.replace(':', '').trim();
                console.log('Comparing label:', label, 'with material name:', mat.name);
                if (label === mat.name.trim()) {
                    const inputs = item.querySelectorAll('input[type="number"]');
                    if (inputs.length >= 2) {
                        inputs[0].value = mat.amount;
                        inputs[1].value = mat.price;
                    }
                }
            });
        });
    } else {
        console.log(`Profession div not found for: ${data.profession}`);
    }
    
    // Update the material summary after loading data
    updateMaterialSummary(data.profession);
}