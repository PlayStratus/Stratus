export type GameType = {
  GameID: string;              // Partition key
  developer: string;           // Developer name
  genres: string[];         // Genres (String array)
  lDescript: string;           // Long description
  s3: string[];             // S3 links (String array)
  sDescript: string;           // Short description
  title: string;               // Game title
};

