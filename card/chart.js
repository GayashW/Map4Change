let chartInstance = null;

export function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryChart').getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        label: 'Nearby Issues',
        data: data.map(d => d.count),
        backgroundColor: '#007BFF'
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
        }
      }
    }
  });
}
