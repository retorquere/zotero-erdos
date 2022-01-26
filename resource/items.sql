SELECT i.itemID AS itemID, idv.Value AS title, i.key AS itemKey, i.libraryID
FROM items i
JOIN itemTypeFields itf ON i.itemTypeID = itf.itemTypeID
JOIN fields f ON itf.fieldID = f.fieldID AND f.fieldName = 'title'
JOIN itemData id ON id.itemID = i.itemID AND id.fieldID = f.fieldID
JOIN itemDataValues idv ON idv.valueID = id.valueID
WHERE i.itemID in (SELECT itemID from itemCreators)
