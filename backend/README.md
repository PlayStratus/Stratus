# Stratus Backend

The backend coordination server is written in TypeScript using express.js, and
is designed to run on AWS in an EC2 instance that communicates with DynamoDB.


## Development Setup

1.  Create an AWS account and setup `Users` and `Games` tables in DynamoDB.

2.  Set applicable options in a `.env` file:

    - `AUTH_SECRET`: the secret used to sign client JWT tokens (**required**)
    - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_ACCESS_KEY_ID`: the AWS access
      credentials (**required**)
    - `PORT`: the TCP port to serve the backend on (defaults to 4000)
    - `STRATUSD_PASSWORD`: The password used to authenticate stratusd nodes (if
      left undefined, authentication is disabled)

3.  Install the required dependencies with `npm install`

4.  Start development server with `npm run dev`
