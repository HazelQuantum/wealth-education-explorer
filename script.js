const width = 1080;
const height = 560;
const margin = { top: 30, right: 180, bottom: 70, left: 80 };

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;

const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const xAxisGroup = plot.append("g")
    .attr("transform", `translate(0,${plotHeight})`);

const yAxisGroup = plot.append("g");

const xLabel = svg.append("text")
    .attr("x", margin.left + plotWidth / 2)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("International Wealth Index (IWI)");

const yLabel = svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + plotHeight / 2))
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Adult literacy rate");

const chartTitle = svg.append("text")
    .attr("x", margin.left)
    .attr("y", 18)
    .style("font-size", "16px")
    .style("font-weight", "bold");

const tooltip = d3.select("#tooltip");

const colorScale = d3.scaleOrdinal()
    .domain(["Africa", "Asia/Pacific", "Europe", "Americas", "Oceania"])
    .range(["#e76f51", "#2a9d8f", "#457b9d", "#8d5fd3", "#e9c46a"]);

const metricLabels = {
    literacy: "Adult literacy rate (%)",
    secondary_enrol: "Secondary school enrolment (%)",
    gov_edu_exp: "Government expenditure on education (% of GDP)"
};

d3.csv("data/final_dataset_q1.csv").then(data => {
    data.forEach(d => {
        d.year = +d.year;
        d.iwi = +d.iwi;
        d.literacy = +d.literacy;
        d.secondary_enrol = +d.secondary_enrol;
        d.gov_edu_exp = +d.gov_edu_exp;

        if (d.continent === "America") d.continent = "Americas";
    });

    const availableYears = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);
    const slider = document.getElementById("yearSlider");
    slider.min = availableYears[0];
    slider.max = availableYears[availableYears.length - 1];
    slider.value = 2015;

    function getSelectedRegions() {
        return Array.from(document.querySelectorAll("#regionFilters input:checked"))
            .map(cb => cb.value);
    }

    function getRegressionLineData(data, xKey, yKey) {
        const validData = data.filter(d => !isNaN(d[xKey]) && !isNaN(d[yKey]));
        const n = validData.length;

        const sumX = d3.sum(validData, d => d[xKey]);
        const sumY = d3.sum(validData, d => d[yKey]);
        const sumXY = d3.sum(validData, d => d[xKey] * d[yKey]);
        const sumXX = d3.sum(validData, d => d[xKey] * d[xKey]);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const xMin = d3.min(validData, d => d[xKey]);
        const xMax = d3.max(validData, d => d[xKey]);

        return [
            { x: xMin, y: slope * xMin + intercept },
            { x: xMax, y: slope * xMax + intercept }
        ];
    }

    function updateChart() {
        const selectedYear = +document.getElementById("yearSlider").value;
        const selectedMetric = document.getElementById("metricSelect").value;

        document.getElementById("yearValue").textContent = selectedYear;

        const selectedRegions = getSelectedRegions();

        const filtered = data.filter(d =>
            d.year === selectedYear &&
            selectedRegions.includes(d.continent) &&
            !isNaN(d.iwi) &&
            !isNaN(d[selectedMetric])
        );

        if (filtered.length === 0) {
            plot.selectAll("circle").remove();
            xAxisGroup.call(d3.axisBottom(d3.scaleLinear().domain([0, 100]).range([0, plotWidth])));
            yAxisGroup.call(d3.axisLeft(d3.scaleLinear().domain([0, 100]).range([plotHeight, 0])));
            chartTitle.text(`No data available for the current selection`);
            return;
        }

        const x = d3.scaleLinear()
            .domain([d3.min(filtered, d => d.iwi) - 2, d3.max(filtered, d => d.iwi) + 2])
            .range([0, plotWidth]);

        const y = d3.scaleLinear()
            .domain([d3.min(filtered, d => d[selectedMetric]) - 2, d3.max(filtered, d => d[selectedMetric]) + 2])
            .range([plotHeight, 0]);

        xAxisGroup.transition().duration(500).call(d3.axisBottom(x));
        yAxisGroup.transition().duration(500).call(d3.axisLeft(y));

        yLabel.text(metricLabels[selectedMetric]);
        chartTitle.text(`Wealth vs ${metricLabels[selectedMetric]} (${selectedYear})`);

        const circles = plot.selectAll("circle")
            .data(filtered, d => d.country_code);

        circles.enter()
            .append("circle")
            .attr("cx", d => x(d.iwi))
            .attr("cy", d => y(d[selectedMetric]))
            .attr("r", 0)
            .attr("fill", d => colorScale(d.continent))
            .attr("opacity", 0.75)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .attr("stroke", "#111")
                    .attr("stroke-width", 1.5);

                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.country}</strong><br>
                        Region: ${d.continent}<br>
                        Year: ${d.year}<br>
                        IWI: ${d.iwi.toFixed(2)}<br>
                        ${metricLabels[selectedMetric]}: ${d[selectedMetric].toFixed(2)}
                    `);
            })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY + 12) + "px");
            })
            .on("mouseout", function () {
                d3.select(this)
                    .attr("stroke", "none");

                tooltip.style("opacity", 0);
            })
            .merge(circles)
            .transition()
            .duration(500)
            .attr("cx", d => x(d.iwi))
            .attr("cy", d => y(d[selectedMetric]))
            .attr("r", 5)
            .attr("fill", d => colorScale(d.continent));

        circles.exit()
            .transition()
            .duration(300)
            .attr("r", 0)
            .remove();

        const regressionData = getRegressionLineData(filtered, "iwi", selectedMetric);

        const lineGenerator = d3.line()
            .x(d => x(d.x))
            .y(d => y(d.y));

        const regressionLine = plot.selectAll(".regression-line")
            .data([regressionData]);

        regressionLine.enter()
            .append("path")
            .attr("class", "regression-line")
            .merge(regressionLine)
            .transition()
            .duration(500)
            .attr("fill", "none")
            .attr("stroke", "#222")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "6,4")
            .attr("d", lineGenerator);

        regressionLine.exit().remove();

        const trendLabel = svg.selectAll(".trend-label")
            .data([0]);

        trendLabel.enter()
            .append("text")
            .attr("class", "trend-label")
            .merge(trendLabel)
            .attr("x", margin.left)
            .attr("y", height - 45)
            .style("font-size", "12px")
            .style("fill", "#444")
            .text("Dashed line shows the overall linear trend.");

        drawLegend();
    }

    function drawLegend() {
        svg.selectAll(".legend").remove();

        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 150}, ${margin.top + 40})`);

        const continents = colorScale.domain();

        continents.forEach((continent, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 22})`);

            row.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 6)
                .attr("fill", colorScale(continent));

            row.append("text")
                .attr("x", 14)
                .attr("y", 4)
                .style("font-size", "12px")
                .text(continent);
        });
    }

    updateChart();

    d3.select("#yearSlider").on("input", updateChart);
    d3.select("#metricSelect").on("change", updateChart);
    d3.selectAll("#regionFilters input").on("change", updateChart);
});
