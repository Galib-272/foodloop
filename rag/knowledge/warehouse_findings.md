# Data warehouse findings (DuckDB)

The DuckDB data warehouse combines the Kaggle food waste data, the synthetic matching data and the app database into a star schema with fact tables (inventory waste, donation matches, app donations) and dimension tables (date, food category, business type, weather, waste reason, area, organization).

## Food waste by category

The overall waste rate in the Kaggle data is 4.88% of units purchased. Prepared Food wastes the most at 7.61%.

- Prepared Food: 7.61% waste rate, 13362 units wasted, high-risk days 25.5%
- Fruits: 4.21% waste rate, 7123 units wasted, high-risk days 13.9%
- Bakery: 4.83% waste rate, 7055 units wasted, high-risk days 19.8%
- Vegetables: 3.96% waste rate, 6684 units wasted, high-risk days 10.7%
- Meat: 4.49% waste rate, 6654 units wasted, high-risk days 14.5%
- Dairy: 3.82% waste rate, 5301 units wasted, high-risk days 9.8%

## Why food is wasted

- Overproduction: 65.45% of wasted units
- Expired: 20.85% of wasted units
- Low Demand: 8.85% of wasted units
- Storage Issue: 4.84% of wasted units

## Waste by day of the week

Thursday has the highest waste rate (5.64%) and Wednesday the lowest (4.2%).

## Which organizations complete donations (synthetic data)

- Food Bank: 69.9% of offers end in delivery, 20703 units delivered
- Community Kitchen: 41.5% of offers end in delivery, 35314 units delivered
- NGO: 40.0% of offers end in delivery, 27455 units delivered
- Orphanage: 33.1% of offers end in delivery, 8001 units delivered
- Shelter: 25.1% of offers end in delivery, 7694 units delivered

## Distance and pickup success (synthetic data)

- 0-2 km: 42.4% success, average travel 10.0 minutes
- 2-5 km: 42.1% success, average travel 16.6 minutes
- 5-10 km: 36.1% success, average travel 31.9 minutes
- 10+ km: 25.0% success, average travel 58.5 minutes
- Unknown: 40.2% success, average travel 17.2 minutes

Shorter distances make successful pickups more likely, which is why distance is a key input to the matching model.
