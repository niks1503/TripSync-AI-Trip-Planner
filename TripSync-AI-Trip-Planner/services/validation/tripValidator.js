
// Constants for Minimum Realistic Costs (in INR)
const MIN_FOOD_COST_PER_PERSON_DAY = 300; // Breakfast, Lunch, Dinner
const MIN_STAY_COST_PER_NIGHT = 800; // Basic budget hotel/hostel
const MIN_LOCAL_TRAVEL_COST_DAY = 200; // Rickshaws, Buses per group/person

export function validateTrip(request) {
    const { budget, people, days } = request;
    const totalBudget = parseFloat(budget);
    const numPeople = parseInt(people);
    const numDays = parseInt(days);

    const errors = [];
    const suggestions = {};

    // 1. Sanity Checks
    if (isNaN(totalBudget) || totalBudget <= 0) errors.push("Budget must be a positive number.");
    if (isNaN(numPeople) || numPeople <= 0) errors.push("Number of people must be at least 1.");
    if (isNaN(numDays) || numDays <= 0) errors.push("Trip duration must be at least 1 day.");

    if (errors.length > 0) {
        return { isValid: false, errors, suggestions };
    }

    // 2. Budget Feasibility Check
    // Formula: (Food * People * Days) + (Stay * Nights) + (Travel * Days)
    const nights = Math.max(0, numDays - 1); // If 1 day trip, 0 nights

    // We assume 1 room per 2-3 people? Let's be generous: stay cost is per room, not per person strictly
    // But usually simplified: Stay Cost * ceil(People/2) * Nights
    const roomsNeeded = Math.ceil(numPeople / 2);

    const estFoodCost = MIN_FOOD_COST_PER_PERSON_DAY * numPeople * numDays;
    const estStayCost = MIN_STAY_COST_PER_NIGHT * roomsNeeded * nights;
    const estTravelCost = MIN_LOCAL_TRAVEL_COST_DAY * numDays; // Lump sum for local travel

    const minRequiredBudget = estFoodCost + estStayCost + estTravelCost;

    if (totalBudget < minRequiredBudget) {
        errors.push(`Budget of ₹${totalBudget} is logically impossible for ${numPeople} people for ${numDays} days.`);
        errors.push(`Minimum realistic budget required is approx ₹${minRequiredBudget}.`);
        errors.push(`Breakdown: Food ~₹${estFoodCost}, Stay ~₹${estStayCost}, Local Travel ~₹${estTravelCost}`);

        suggestions.min_budget = minRequiredBudget;
        suggestions.reduce_days_to = Math.floor(totalBudget / (MIN_FOOD_COST_PER_PERSON_DAY * numPeople + MIN_LOCAL_TRAVEL_COST_DAY));
    }

    // 3. People vs Days Sanity
    // Example: 1 Day trip for 20 people? Feasible but usually needs strict planning.
    if (numPeople > 15) {
        errors.push("Group size > 15 usually requires agency booking, not AI planning.");
    }

    return {
        isValid: errors.length === 0,
        errors,
        suggestions
    };
}
