import {GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"


import { dynamoDb } from "../server.mjs"

/* 
Game structure:
GameID: String;
Title: String;
sDescript: String;
lDescript: String;
s3_1: String;
s3_2: String;
*/

export const ControllerGetAll = async (req, res) => {
  try {
    const params = {
    TableName: 'Games',
  };
  const result = await dynamoDb.send(new ScanCommand(params));
  res.status(200).json(result.Items);

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const ControllerGetID = async (req, res) => {
  try {
    const { id } = req.params;
    const params = {
    TableName: 'Games',
    Key: {GameID :id} ,
  };
  const user = await dynamoDb.send(new GetCommand(params));
  res.status(200).json(user.Item);
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}