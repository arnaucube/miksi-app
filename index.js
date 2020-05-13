var circuit = {};
var provingKey = {};
var witnessCalc = {};

function loadCircuit(circuitname) {
  fetch("circuits-files/"+circuitname+"-proving_key.bin").then( (response) => {
    return response.arrayBuffer();
  }).then( (b) => {
    provingKey[circuitname] = b;
    console.log("proving_key loaded for", circuitname);
  });

  fetch("circuits-files/"+circuitname+".wasm").then( (response) => {
    return response.arrayBuffer();
  }).then( (b) => {
    witnessCalc[circuitname] = b;
    console.log("w", b);
    console.log("witnessCalc loaded for", circuitname);
  });
}

async function deposit(circuitname) {
  console.log("circuit:", circuitname);

  // TODO
  const secret = "1234567890";
  const nullifier = "567891234";
  const commitments = [];

  // witness
  console.log(witnessCalc[circuitname]);
  const witness = await miksi.calcWitness(witnessCalc[circuitname], secret, nullifier, commitments);
  console.log("w", witness);

  // proof
  const start = new Date().getTime();
  console.log(provingKey[circuitname]);
  const proof = await window.groth16GenProof(witness.buffer, provingKey[circuitname]);
  const end = new Date().getTime();
  const time = end - start;
  console.log("circuit " + circuitname + " took " + time + "ms to compute");
  console.log(proof);
}

loadCircuit("deposit");
loadCircuit("withdraw");


// var web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
