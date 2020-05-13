var circuit = {};
var provingKey = {};
var witnessCalc = {};
const abi = JSON.parse(`[{"inputs":[{"internalType":"address","name":"_depositVerifierContractAddr","type":"address"},{"internalType":"address","name":"_withdrawVerifierContractAddr","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"uint256","name":"_commitment","type":"uint256"},{"internalType":"uint256","name":"_root","type":"uint256"},{"internalType":"uint256[2]","name":"a","type":"uint256[2]"},{"internalType":"uint256[2][2]","name":"b","type":"uint256[2][2]"},{"internalType":"uint256[2]","name":"c","type":"uint256[2]"}],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getCommitments","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address payable","name":"_address","type":"address"},{"internalType":"uint256","name":"nullifier","type":"uint256"},{"internalType":"uint256[2]","name":"a","type":"uint256[2]"},{"internalType":"uint256[2][2]","name":"b","type":"uint256[2][2]"},{"internalType":"uint256[2]","name":"c","type":"uint256[2]"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]`);
const miksiAddress = "0x6E77f4bB1356426baD1Bd014d04388eFAc197Fe1";

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
  document.getElementById("depositRes").innerHTML = `
    Generating zkProof & making the deposit
  `;
  console.log("circuit:", circuitname);

  // TODO
  const secret = "1234567890";
  const nullifier = "567891234";
  const commitments = [];
  // getCommitments from the tree

  // calculate witness
  console.log(witnessCalc[circuitname]);
  const cw = await miksi.calcWitness(witnessCalc[circuitname], secret, nullifier, commitments);
  const witness = cw.witness;
  const publicInputs = cw.publicInputs;
  console.log("w", witness);
  console.log("pi", publicInputs);

  // generate proof
  const start = new Date().getTime();
  console.log(provingKey[circuitname]);
  const proof = await window.groth16GenProof(witness.buffer, provingKey[circuitname]);
  const end = new Date().getTime();
  const time = end - start;
  console.log("circuit " + circuitname + " took " + time + "ms to compute");
  console.log(proof);


  // send tx
  const accounts = await web3.eth.getAccounts();
  const sender = accounts[0];
  console.log("SENDER", sender);

  console.log("sc call data",
    publicInputs.commitment,
    publicInputs.root.toString(),
    [proof.pi_a[0], proof.pi_a[1]],
    [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    [proof.pi_c[0], proof.pi_c[1]],
  );
  miksiContract.methods.deposit(
    publicInputs.commitment,
    publicInputs.root.toString(),
    [proof.pi_a[0], proof.pi_a[1]],
    [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    [proof.pi_c[0], proof.pi_c[1]],
  ).send(
    {from: sender, value: 1000000000000000000},
    function(error, transactionHash){
      console.log("https://goerli.etherscan.io/tx/"+transactionHash);
      console.log(error);
    });

  // print secret & nullifier
  document.getElementById("depositRes").innerHTML = `
    Secret: <b>`+secret+`</b><br>
    Nullifier: <b>`+nullifier+`</b><br>
  `;
}

loadCircuit("deposit");
loadCircuit("withdraw");




let miksiContract;

function connectMetamask() {
  const ethEnabled = () => {
    if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
      window.ethereum.enable();
      return true;
    }
    return false;
  }

  if (!ethEnabled()) {
    alert("Please install MetaMask to use miksi");
  }

  console.log("abi", abi);
  miksiContract = new web3.eth.Contract(abi, miksiAddress);
  console.log("miksiContract", miksiContract);

  web3.eth.getBalance("0x35d4dCDdB728CeBF80F748be65bf84C776B0Fbaf", function(err, res){console.log("BAL", JSON.stringify(res));});

  miksiContract.methods.getCommitments().call()
    .then(console.log);
}
