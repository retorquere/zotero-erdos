SELECT DISTINCT
  itemID,
  ic.creatorID, TRIM(c.firstName || ' ' || c.lastName) as creatorName,
  l.creatorID as lastNameID, l.lastName
FROM itemCreators ic
JOIN creators c ON c.creatorID = ic.creatorID
JOIN (SELECT MIN(creatorID) as creatorID, lastName FROM creators GROUP BY lastName) l ON l.lastName = c.lastName
