-- FoodSphere AI warehouse: analytics queries.
-- Each block starts with "-- name: <report>" and is saved to ml/warehouse/reports/<report>.csv

-- name: waste_by_category
-- Which food categories waste the most, in units and as a share of what was bought?
SELECT c.category_name                                          AS food_category,
       c.is_perishable,
       COUNT(*)                                                 AS records,
       SUM(f.purchase_quantity)                                 AS units_purchased,
       SUM(f.waste_quantity)                                    AS units_wasted,
       ROUND(100.0 * SUM(f.waste_quantity) / SUM(f.purchase_quantity), 2) AS waste_rate_pct,
       ROUND(100.0 * AVG(CASE WHEN f.waste_level = 'High' THEN 1 ELSE 0 END), 1) AS high_risk_days_pct
FROM fact_inventory_waste f
JOIN dim_food_category c USING (category_key)
GROUP BY ALL
ORDER BY units_wasted DESC;

-- name: waste_by_weekday
-- Do some days of the week waste more food?
SELECT d.day_of_week,
       d.weekday_name,
       SUM(f.waste_quantity)                                    AS units_wasted,
       ROUND(AVG(f.waste_quantity), 2)                          AS avg_waste_per_record,
       ROUND(100.0 * SUM(f.waste_quantity) / SUM(f.purchase_quantity), 2) AS waste_rate_pct
FROM fact_inventory_waste f
JOIN dim_date d USING (date_key)
GROUP BY ALL
ORDER BY d.day_of_week;

-- name: waste_by_business_type
SELECT b.business_type_name                                     AS business_type,
       COUNT(*)                                                 AS records,
       SUM(f.waste_quantity)                                    AS units_wasted,
       ROUND(100.0 * SUM(f.waste_quantity) / SUM(f.purchase_quantity), 2) AS waste_rate_pct,
       ROUND(100.0 * AVG(CASE WHEN f.donation_made THEN 1 ELSE 0 END), 1) AS donation_rate_pct
FROM fact_inventory_waste f
JOIN dim_business_type b USING (business_type_key)
GROUP BY ALL
ORDER BY units_wasted DESC;

-- name: monthly_waste_trend
-- Month-by-month waste with a 3-month moving average.
SELECT d.year,
       d.month,
       d.month_name,
       SUM(f.waste_quantity)                                    AS units_wasted,
       ROUND(100.0 * SUM(f.waste_quantity) / SUM(f.purchase_quantity), 2) AS waste_rate_pct,
       ROUND(AVG(SUM(f.waste_quantity)) OVER (ORDER BY d.year, d.month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1)
                                                                AS units_wasted_3m_avg
FROM fact_inventory_waste f
JOIN dim_date d USING (date_key)
GROUP BY d.year, d.month, d.month_name
ORDER BY d.year, d.month;

-- name: waste_reasons
SELECT r.waste_reason_name                                      AS waste_reason,
       COUNT(*)                                                 AS records,
       SUM(f.waste_quantity)                                    AS units_wasted,
       ROUND(100.0 * SUM(f.waste_quantity) / SUM(SUM(f.waste_quantity)) OVER (), 2) AS share_of_waste_pct
FROM fact_inventory_waste f
JOIN dim_waste_reason r USING (waste_reason_key)
WHERE f.waste_quantity > 0
GROUP BY ALL
ORDER BY units_wasted DESC;

-- name: waste_by_weather_and_promotion
SELECT w.weather_name                                           AS weather,
       f.promotion,
       COUNT(*)                                                 AS records,
       ROUND(AVG(f.waste_quantity), 2)                          AS avg_waste,
       ROUND(100.0 * SUM(f.waste_quantity) / SUM(f.purchase_quantity), 2) AS waste_rate_pct
FROM fact_inventory_waste f
JOIN dim_weather w USING (weather_key)
GROUP BY ALL
ORDER BY weather, f.promotion;

-- name: match_success_by_org_type
-- Which kinds of organizations accept and receive donations most reliably? (synthetic data)
SELECT o.org_type,
       COUNT(*)                                                 AS offers,
       ROUND(100.0 * AVG(CASE WHEN m.successful_match THEN 1 ELSE 0 END), 1) AS success_rate_pct,
       SUM(m.delivered_quantity)                                AS units_delivered,
       ROUND(AVG(m.distance_km), 2)                             AS avg_distance_km
FROM fact_donation_match m
JOIN dim_organization o USING (organization_key)
GROUP BY ALL
ORDER BY success_rate_pct DESC;

-- name: match_success_by_distance
-- How quickly does the chance of a successful pickup fall with distance? (synthetic data)
SELECT CASE WHEN m.distance_km IS NULL THEN 'Unknown'
            WHEN m.distance_km < 2  THEN '0-2 km'
            WHEN m.distance_km < 5  THEN '2-5 km'
            WHEN m.distance_km < 10 THEN '5-10 km'
            ELSE '10+ km' END                                   AS distance_band,
       COALESCE(MIN(m.distance_km), 999)                        AS band_min_km,
       COUNT(*)                                                 AS offers,
       ROUND(100.0 * AVG(CASE WHEN m.successful_match THEN 1 ELSE 0 END), 1) AS success_rate_pct,
       ROUND(AVG(m.travel_time_min), 1)                         AS avg_travel_min
FROM fact_donation_match m
GROUP BY ALL
ORDER BY band_min_km;

-- name: match_failure_reasons
SELECT COALESCE(NULLIF(m.failure_reason, ''), 'None')           AS failure_reason,
       COUNT(*)                                                 AS offers,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)       AS share_pct
FROM fact_donation_match m
WHERE NOT m.successful_match
GROUP BY ALL
ORDER BY offers DESC;

-- name: rescue_by_area
-- Units rescued per donor area, and the top category rescued there. (synthetic data)
SELECT a.area_name                                              AS donor_area,
       COUNT(DISTINCT m.donation_id)                            AS donations,
       SUM(m.delivered_quantity)                                AS units_delivered,
       ROUND(100.0 * AVG(CASE WHEN m.successful_match THEN 1 ELSE 0 END), 1) AS success_rate_pct,
       ARG_MAX(c.category_name, m.delivered_quantity)           AS top_category
FROM fact_donation_match m
JOIN dim_area a ON a.area_key = m.donor_area_key
JOIN dim_food_category c USING (category_key)
GROUP BY ALL
ORDER BY units_delivered DESC;

-- name: app_donation_status
-- Live app donations by status (empty if the app database was not found).
SELECT donation_status,
       COUNT(*)                                                 AS donations,
       ROUND(SUM(quantity_available), 1)                        AS quantity_listed,
       ROUND(SUM(COALESCE(quantity_delivered, 0)), 1)           AS quantity_delivered
FROM fact_app_donation
GROUP BY ALL
ORDER BY donations DESC;
