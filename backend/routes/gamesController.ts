import {GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import type { Request, Response } from 'express';

import { dynamoDb } from "../server.mjs"

type GameItem = {
  GameID: string;              // Partition key
  developer: string;           // Developer name
  genres: Set<string>;         // Genres (String set)
  lDescript: string;           // Long description
  s3: Set<string>;             // S3 links (String set)
  sDescript: string;           // Short description
  title: string;               // Game title
};

export const ControllerGetAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = {
    TableName: 'Games',
    };
    const games = await dynamoDb.send(new ScanCommand(params));
    res.status(200).json(games.Items);
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
};

export const ControllerGetByID = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Game ID is required' });
    return;
  }
  try {
    const params = {
    TableName: 'Games',
    Key: {GameID :id} ,
    };
    const game = await dynamoDb.send(new GetCommand(params));
    res.status(200).json(game.Item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch game' });
  }
};
