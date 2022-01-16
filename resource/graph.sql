SELECT
  'I' || CAST(X'09' AS TEXT) || i.itemID AS v,
  'C' || CAST(X'09' AS TEXT) || CASE c.fieldMode WHEN 1 THEN c.lastName ELSE c.lastName || CAST(X'09' AS TEXT) || c.firstName END as w
FROM itemCreators i
JOIN creators c on c.creatorID = i.creatorID
