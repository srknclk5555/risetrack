function updateMaterialSummary(profession) {
    const summaryElement = document.getElementById(`${profession}-summary`);
    if (!summaryElement) {
        console.log(`Summary element not found for profession: ${profession}`);
        return;
    }
    
    const professionDiv = document.getElementById(profession);
    if (!professionDiv) {
        console.log(`Profession div not found for: ${profession}`);
        return;
    }
    
    const materialItems = professionDiv.querySelectorAll('.material-item');
    let summaryHTML = '';
    let totalValue = 0;
    
    materialItems.forEach(item => {
        const inputs = item.querySelectorAll('input[type="number"]');
        const labelText = item.querySelector('label').textContent;
        const label = labelText.replace(':', '').trim();
        const amount = parseInt(inputs[0].value) || 0;
        const price = parseFloat(inputs[1].value) || 0;
        const value = amount * price;
        
        if (amount > 0) {
            totalValue += value;
            summaryHTML += `
                <div class="summary-item">
                    <span class="summary-item-name">${label}:</span>
                    <span class="summary-item-quantity">${amount}</span>
                    <span class="summary-item-value">${value.toFixed(2)}💰</span>
                </div>
            `;
        }
    });
    
    if (summaryHTML) {
        summaryHTML += `
            <div class="summary-item" style="border-top: 2px solid #667eea; margin-top: 10px; padding-top: 10px;">
                <span class="summary-item-name">Total Value:</span>
                <span class="summary-item-value">${totalValue.toFixed(2)}💰</span>
            </div>
        `;
    } else {
        summaryHTML = '<div class="summary-item">No materials entered</div>';
    }
    
    summaryElement.innerHTML = summaryHTML;
}